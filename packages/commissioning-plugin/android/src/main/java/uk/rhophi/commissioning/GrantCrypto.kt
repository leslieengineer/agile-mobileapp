package uk.rhophi.commissioning

import javax.crypto.Cipher
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec
import org.bouncycastle.asn1.x509.SubjectPublicKeyInfo
import org.bouncycastle.crypto.agreement.X25519Agreement
import org.bouncycastle.crypto.digests.SHA256Digest
import org.bouncycastle.crypto.generators.HKDFBytesGenerator
import org.bouncycastle.crypto.params.HKDFParameters
import org.bouncycastle.crypto.params.X25519PrivateKeyParameters
import org.bouncycastle.crypto.params.X25519PublicKeyParameters

internal data class EncryptedGrant(
    val serverPublicKey: String,
    val nonce: String,
    val ciphertext: String,
    val authenticationTag: String,
    val transactionId: String,
)

internal object GrantCrypto {
    fun decrypt(privateKeyBytes: ByteArray, grant: EncryptedGrant): ByteArray {
        val serverSpki = SubjectPublicKeyInfo.getInstance(Base64Url.decode(grant.serverPublicKey))
        val publicKey = X25519PublicKeyParameters(serverSpki.publicKeyData.bytes, 0)
        val privateKey = X25519PrivateKeyParameters(privateKeyBytes, 0)
        val agreement = X25519Agreement().apply { init(privateKey) }
        val shared = ByteArray(agreement.agreementSize)
        agreement.calculateAgreement(publicKey, shared, 0)
        val key = ByteArray(32)
        try {
            HKDFBytesGenerator(SHA256Digest()).apply {
                init(HKDFParameters(shared, grant.transactionId.toByteArray(), "rhophi-provisioning-v1".toByteArray()))
                generateBytes(key, 0, key.size)
            }
            val ciphertext = Base64Url.decode(grant.ciphertext)
            val tag = Base64Url.decode(grant.authenticationTag)
            require(tag.size == 16) { "Invalid authentication tag" }
            val combined = ciphertext + tag
            ciphertext.fill(0)
            tag.fill(0)
            try {
                val cipher = Cipher.getInstance("AES/GCM/NoPadding")
                cipher.init(
                    Cipher.DECRYPT_MODE,
                    SecretKeySpec(key, "AES"),
                    GCMParameterSpec(128, Base64Url.decode(grant.nonce)),
                )
                cipher.updateAAD(grant.transactionId.toByteArray())
                return cipher.doFinal(combined)
            } finally {
                combined.fill(0)
            }
        } finally {
            shared.fill(0)
            key.fill(0)
            privateKeyBytes.fill(0)
        }
    }
}
