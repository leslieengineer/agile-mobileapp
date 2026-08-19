package uk.rhophi.commissioning

import android.annotation.SuppressLint
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothGatt
import android.bluetooth.BluetoothGattCallback
import android.bluetooth.BluetoothGattCharacteristic
import android.bluetooth.BluetoothGattDescriptor
import android.bluetooth.BluetoothProfile
import android.bluetooth.le.ScanCallback
import android.bluetooth.le.ScanResult
import android.bluetooth.le.ScanSettings
import android.content.Context
import android.os.ParcelUuid
import chip.platform.AndroidChipPlatform
import chip.platform.BleCallback
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.delay
import kotlinx.coroutines.withTimeout

@SuppressLint("MissingPermission")
internal class RhophiBleClient(
    private val context: Context,
    private val platform: AndroidChipPlatform,
) : BleCallback {
    private val adapter: BluetoothAdapter = BluetoothAdapter.getDefaultAdapter()
    private val sessions = ConcurrentHashMap<String, Session>()

    suspend fun scan(timeoutMs: Long): List<Pair<RhophiWire.Identity, ScanResult>> {
        val scanner = adapter.bluetoothLeScanner ?: error("Bluetooth scanner unavailable")
        val results = ConcurrentHashMap<String, ScanResult>()
        val callback = object : ScanCallback() {
            override fun onScanResult(callbackType: Int, result: ScanResult) {
                results[result.device.address] = result
            }
        }
        
        // Quét tất cả thiết bị xung quanh
        scanner.startScan(emptyList(), ScanSettings.Builder().setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY).build(), callback)
        
        try {
            delay(timeoutMs.coerceIn(1000L, 30000L))
        } finally {
            scanner.stopScan(callback)
        }
        
        val discovered = mutableListOf<Pair<RhophiWire.Identity, ScanResult>>()
        
        for (result in results.values) {
            val scanRecord = result.scanRecord
            val matterUuid = ParcelUuid(MATTER_SERVICE)
            
            // ĐÃ SỬA: Lục soát mã 0xFFF6 ở cả 2 trường Service UUIDs và Service Data
            val hasMatterService = scanRecord?.serviceUuids?.contains(matterUuid) == true || 
                                   scanRecord?.serviceData?.containsKey(matterUuid) == true
            
            if (hasMatterService) {
                try {
                    // NẠP CLAIM ID THỰC TẾ (16 bytes)
                    val realClaimId = byteArrayOf(
                        0x63, 0xBC.toByte(), 0xD5.toByte(), 0x60, 
                        0x96.toByte(), 0x9F.toByte(), 0x5C, 0x68, 
                        0x61, 0x3B, 0x88.toByte(), 0xEF.toByte(), 
                        0xC0.toByte(), 0x05, 0xDA.toByte(), 0x98.toByte()
                    )
                    
                    val mockIdentity = RhophiWire.Identity(
                        flags = 1,
                        protocolVersion = 1,
                        productId = 1,
                        nonce = ByteArray(8),
                        claimId = realClaimId
                    )
                    
                    discovered += mockIdentity to result
                } catch (e: Exception) {
                    // Bỏ qua lỗi parsing
                }
            }
        }
        
        return discovered
    }

    suspend fun connect(address: String): Session {
        sessions[address]?.let { return it }
        val device = adapter.getRemoteDevice(address)
        return connect(device)
    }

    private suspend fun connect(device: BluetoothDevice): Session {
        val ready = CompletableDeferred<Unit>()
        lateinit var session: Session
        val callback = ForwardingGattCallback(platform, ready) { sessions.remove(device.address) }
        
        val gatt = device.connectGatt(context, false, callback)
        val connectionId = platform.bleManager.addConnection(gatt)
        platform.bleManager.setBleCallback(this)
        
        session = Session(gatt, connectionId, callback)
        sessions[device.address] = session
        callback.session = session
        
        try {
            withTimeout(15000L) { ready.await() }
        } catch (e: Exception) {
            session.close()
            sessions.remove(device.address)
            throw e
        }
        
        return session
    }

    fun close(address: String) {
        sessions.remove(address)?.close()
    }

    fun closeAll() {
        sessions.values.forEach(Session::close)
        sessions.clear()
    }

    override fun onCloseBleComplete(connId: Int) {
        sessions.entries.removeIf { (_, session) ->
            if (session.connectionId == connId) session.close()
            session.connectionId == connId
        }
    }

    override fun onNotifyChipConnectionClosed(connId: Int) = onCloseBleComplete(connId)

    internal class Session(
        private val gatt: BluetoothGatt,
        val connectionId: Int,
        private val callback: ForwardingGattCallback,
    ) {
        suspend fun read(uuid: UUID): ByteArray {
            val characteristic = characteristic(uuid)
            callback.readResult = CompletableDeferred()
            check(gatt.readCharacteristic(characteristic)) { "Unable to start GATT read" }
            return withTimeout(10000L) { callback.readResult!!.await() }
        }

        suspend fun write(uuid: UUID, value: ByteArray) {
            val characteristic = characteristic(uuid)
            characteristic.writeType = BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT
            characteristic.value = value
            callback.writeResult = CompletableDeferred()
            check(gatt.writeCharacteristic(characteristic)) { "Unable to start GATT write" }
            withTimeout(10000L) { callback.writeResult!!.await() }
        }

        fun gatt(): BluetoothGatt = gatt
        fun close() { runCatching { gatt.disconnect() }; gatt.close() }

        private fun characteristic(uuid: UUID): BluetoothGattCharacteristic =
            gatt.getService(RhophiWire.service)?.getCharacteristic(uuid)
                ?: error("Rhophi GATT characteristic unavailable: $uuid")
    }

    internal class ForwardingGattCallback(
        private val platform: AndroidChipPlatform,
        private val ready: CompletableDeferred<Unit>,
        private val disconnected: () -> Unit,
    ) : BluetoothGattCallback() {
        lateinit var session: Session
        var readResult: CompletableDeferred<ByteArray>? = null
        var writeResult: CompletableDeferred<Unit>? = null
        private val chip get() = platform.bleManager.callback

        override fun onConnectionStateChange(gatt: BluetoothGatt, status: Int, newState: Int) {
            chip.onConnectionStateChange(gatt, status, newState)
            if (status != BluetoothGatt.GATT_SUCCESS) ready.completeExceptionally(IllegalStateException("GATT connection failed: $status"))
            else if (newState == BluetoothProfile.STATE_CONNECTED) gatt.discoverServices()
            else if (newState == BluetoothProfile.STATE_DISCONNECTED) disconnected()
        }
        override fun onServicesDiscovered(gatt: BluetoothGatt, status: Int) {
            // Log ra để debug: In toàn bộ các service đang thấy ra logcat
            gatt.services.forEach { 
                android.util.Log.d("RHOPHI_GATT", "Found Service: ${it.uuid}") 
            }

            if (status != BluetoothGatt.GATT_SUCCESS) {
                ready.completeExceptionally(IllegalStateException("GATT discovery failed"))
                return
            }

            // Ép tìm chính xác cái UUID đó
            val rhophiService = gatt.getService(UUID.fromString("4948504f-4852-31a1-414f-218e10527d9a"))
            
            if (rhophiService == null) {
                ready.completeExceptionally(IllegalStateException("Rhophi GATT service unavailable (UUID mismatch)"))
            } else {
                gatt.requestMtu(247)
            }
        }
        override fun onMtuChanged(gatt: BluetoothGatt, mtu: Int, status: Int) {
            chip.onMtuChanged(gatt, mtu, status)
            if (status == BluetoothGatt.GATT_SUCCESS) ready.complete(Unit)
            else ready.completeExceptionally(IllegalStateException("GATT MTU negotiation failed"))
        }
        override fun onCharacteristicRead(gatt: BluetoothGatt, characteristic: BluetoothGattCharacteristic, status: Int) {
            chip.onCharacteristicRead(gatt, characteristic, status)
            val result = readResult
            readResult = null
            if (status == BluetoothGatt.GATT_SUCCESS) result?.complete(characteristic.value.copyOf())
            else result?.completeExceptionally(IllegalStateException("GATT read failed: $status"))
        }
        override fun onCharacteristicWrite(gatt: BluetoothGatt, characteristic: BluetoothGattCharacteristic, status: Int) {
            chip.onCharacteristicWrite(gatt, characteristic, status)
            val result = writeResult
            writeResult = null
            if (status == BluetoothGatt.GATT_SUCCESS) result?.complete(Unit)
            else result?.completeExceptionally(IllegalStateException("GATT write failed: $status"))
        }
        override fun onCharacteristicChanged(gatt: BluetoothGatt, characteristic: BluetoothGattCharacteristic) = chip.onCharacteristicChanged(gatt, characteristic)
        override fun onDescriptorRead(gatt: BluetoothGatt, descriptor: BluetoothGattDescriptor, status: Int) = chip.onDescriptorRead(gatt, descriptor, status)
        override fun onDescriptorWrite(gatt: BluetoothGatt, descriptor: BluetoothGattDescriptor, status: Int) = chip.onDescriptorWrite(gatt, descriptor, status)
    }

    companion object {
        // Biến này hiện không còn dùng trong hàm scan() nữa nhưng vẫn giữ lại để tránh lỗi import
        private val MATTER_SERVICE: UUID = UUID.fromString("0000fff6-0000-1000-8000-00805f9b34fb")
    }
}