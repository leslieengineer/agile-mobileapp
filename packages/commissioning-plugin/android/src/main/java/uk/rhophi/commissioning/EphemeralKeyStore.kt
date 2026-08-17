package uk.rhophi.commissioning

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import org.bouncycastle.crypto.params.X25519PrivateKeyParameters
import java.security.SecureRandom

internal class EphemeralKeyStore(context: Context) {
    private val preferences = context.getSharedPreferences("rhophi_commissioning_keys", Context.MODE_PRIVATE)

    fun create(transactionHint: String): String {
        require(transactionHint.isNotBlank())
        val privateKey = X25519PrivateKeyParameters(SecureRandom())
        val publicKey = privateKey.generatePublicKey()
        val encodedPrivate = privateKey.encoded
        try {
            val cipher = Cipher.getInstance(TRANSFORMATION)
            cipher.init(Cipher.ENCRYPT_MODE, wrappingKey())
            val prefix = keyPrefix(transactionHint)
            preferences.edit()
                .putString("${prefix}_private", Base64.encodeToString(cipher.doFinal(encodedPrivate), Base64.NO_WRAP))
                .putString("${prefix}_iv", Base64.encodeToString(cipher.iv, Base64.NO_WRAP))
                .apply()
            val spki = SPKI_PREFIX + publicKey.encoded
            return Base64Url.encode(spki)
        } finally {
            encodedPrivate.fill(0)
        }
    }

    fun load(transactionHint: String): ByteArray {
        val prefix = keyPrefix(transactionHint)
        val encrypted = preferences.getString("${prefix}_private", null) ?: error("Ephemeral key unavailable")
        val iv = preferences.getString("${prefix}_iv", null) ?: error("Ephemeral key unavailable")
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(
            Cipher.DECRYPT_MODE,
            wrappingKey(),
            GCMParameterSpec(128, Base64.decode(iv, Base64.NO_WRAP)),
        )
        return cipher.doFinal(Base64.decode(encrypted, Base64.NO_WRAP))
    }

    fun clear(transactionHint: String) {
        val prefix = keyPrefix(transactionHint)
        preferences.edit().remove("${prefix}_private").remove("${prefix}_iv").apply()
    }

    private fun wrappingKey(): SecretKey {
        val keyStore = KeyStore.getInstance(KEYSTORE).apply { load(null) }
        (keyStore.getKey(KEY_ALIAS, null) as? SecretKey)?.let { return it }
        val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, KEYSTORE)
        generator.init(
            KeyGenParameterSpec.Builder(
                KEY_ALIAS,
                KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT,
            )
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .build(),
        )
        return generator.generateKey()
    }

    private fun keyPrefix(value: String) = value.toByteArray().fold(0x811c9dc5.toInt()) { hash, byte ->
        (hash xor byte.toInt()) * 0x01000193
    }.toUInt().toString(16)

    companion object {
        private const val KEYSTORE = "AndroidKeyStore"
        private const val KEY_ALIAS = "rhophi_commissioning_wrap"
        private const val TRANSFORMATION = "AES/GCM/NoPadding"
        private val SPKI_PREFIX = byteArrayOf(0x30, 0x2a, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x6e, 0x03, 0x21, 0x00)
    }
}

internal object Base64Url {
    fun encode(value: ByteArray): String = Base64.encodeToString(value, Base64.URL_SAFE or Base64.NO_WRAP or Base64.NO_PADDING)
    fun decode(value: String): ByteArray = Base64.decode(value, Base64.URL_SAFE or Base64.NO_WRAP or Base64.NO_PADDING)
}
