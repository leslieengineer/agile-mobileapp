package uk.rhophi.commissioning

import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.util.UUID

internal object RhophiWire {
    val service: UUID = UUID.fromString("9a7d5210-8e21-4f41-a131-52484f504849")
    val identity: UUID = UUID.fromString("9a7d5211-8e21-4f41-a131-52484f504849")
    val challenge: UUID = UUID.fromString("9a7d5212-8e21-4f41-a131-52484f504849")
    val response: UUID = UUID.fromString("9a7d5213-8e21-4f41-a131-52484f504849")
    val state: UUID = UUID.fromString("9a7d5214-8e21-4f41-a131-52484f504849")
    val identify: UUID = UUID.fromString("9a7d5215-8e21-4f41-a131-52484f504849")
    val cancel: UUID = UUID.fromString("9a7d5216-8e21-4f41-a131-52484f504849")

    fun decodeIdentity(value: ByteArray): Identity {
        require(value.size == 36) { "Invalid Rhophi identity length" }
        val buffer = ByteBuffer.wrap(value).order(ByteOrder.LITTLE_ENDIAN)
        val version = buffer.get().toInt() and 0xff
        val productId = buffer.short.toInt() and 0xffff
        val claimId = ByteArray(16).also(buffer::get)
        val nonce = ByteArray(16).also(buffer::get)
        val flags = buffer.get().toInt() and 0xff
        return Identity(version, productId, claimId, nonce, flags)
    }

    data class Identity(
        val protocolVersion: Int,
        val productId: Int,
        val claimId: ByteArray,
        val nonce: ByteArray,
        val flags: Int,
    )
}
