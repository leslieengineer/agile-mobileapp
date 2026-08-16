package uk.rhophi.mobile

import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

@CapacitorPlugin(name = "SecureSession")
class SecureSessionPlugin : Plugin() {
    private val preferences by lazy {
        context.getSharedPreferences("rhophi_secure_session", 0)
    }

    @PluginMethod
    fun setToken(call: PluginCall) {
        val token = call.getString("token")
        if (token.isNullOrBlank()) {
            call.reject("Token is required")
            return
        }
        try {
            val cipher = Cipher.getInstance(TRANSFORMATION)
            cipher.init(Cipher.ENCRYPT_MODE, getOrCreateKey())
            val encrypted = cipher.doFinal(token.toByteArray(Charsets.UTF_8))
            preferences.edit()
                .putString(CIPHERTEXT, Base64.encodeToString(encrypted, Base64.NO_WRAP))
                .putString(IV, Base64.encodeToString(cipher.iv, Base64.NO_WRAP))
                .apply()
            call.resolve()
        } catch (_: Exception) {
            call.reject("Unable to protect session")
        }
    }

    @PluginMethod
    fun getToken(call: PluginCall) {
        val encrypted = preferences.getString(CIPHERTEXT, null)
        val iv = preferences.getString(IV, null)
        if (encrypted == null || iv == null) {
            call.resolve(JSObject())
            return
        }
        try {
            val cipher = Cipher.getInstance(TRANSFORMATION)
            cipher.init(
                Cipher.DECRYPT_MODE,
                getOrCreateKey(),
                GCMParameterSpec(128, Base64.decode(iv, Base64.NO_WRAP)),
            )
            val token = cipher.doFinal(Base64.decode(encrypted, Base64.NO_WRAP)).toString(Charsets.UTF_8)
            call.resolve(JSObject().put("token", token))
        } catch (_: Exception) {
            preferences.edit().clear().apply()
            call.reject("Unable to restore session")
        }
    }

    @PluginMethod
    fun clearToken(call: PluginCall) {
        preferences.edit().clear().apply()
        call.resolve()
    }

    private fun getOrCreateKey(): SecretKey {
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

    companion object {
        private const val KEYSTORE = "AndroidKeyStore"
        private const val KEY_ALIAS = "rhophi_session_aes"
        private const val TRANSFORMATION = "AES/GCM/NoPadding"
        private const val CIPHERTEXT = "ciphertext"
        private const val IV = "iv"
    }
}
