package com.smartecoenterprise.app.wear.data.auth

import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/**
 * AES-256-GCM encryption backed by an AndroidKeyStore key.
 *
 * Used instead of Jetpack Security's EncryptedSharedPreferences, which is
 * deprecated. The key never leaves the keystore (hardware-backed on essentially
 * every API 30+ watch); only the ciphertext reaches DataStore.
 *
 * Wire format is `IV || ciphertext`, Base64-encoded. GCM needs a unique IV per
 * encryption, so a fresh one is generated each time by the Cipher and prepended.
 */
object CryptoBox {

    private const val KEYSTORE = "AndroidKeyStore"
    private const val KEY_ALIAS = "smarteco_wear_session"
    private const val TRANSFORMATION = "AES/GCM/NoPadding"
    private const val IV_LENGTH = 12
    private const val TAG_LENGTH_BITS = 128

    fun encrypt(plaintext: String): String {
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(Cipher.ENCRYPT_MODE, getOrCreateKey())
        val iv = cipher.iv
        val encrypted = cipher.doFinal(plaintext.toByteArray(Charsets.UTF_8))
        return Base64.encodeToString(iv + encrypted, Base64.NO_WRAP)
    }

    /**
     * Returns null when the blob cannot be decrypted — a wiped or rotated
     * keystore key, or corrupted storage. Callers treat that as "no session"
     * and send the user back to login rather than crashing.
     */
    fun decrypt(encoded: String): String? = try {
        val bytes = Base64.decode(encoded, Base64.NO_WRAP)
        if (bytes.size <= IV_LENGTH) {
            null
        } else {
            val cipher = Cipher.getInstance(TRANSFORMATION)
            cipher.init(
                Cipher.DECRYPT_MODE,
                getOrCreateKey(),
                GCMParameterSpec(TAG_LENGTH_BITS, bytes, 0, IV_LENGTH),
            )
            String(
                cipher.doFinal(bytes, IV_LENGTH, bytes.size - IV_LENGTH),
                Charsets.UTF_8,
            )
        }
    } catch (e: Exception) {
        null
    }

    private fun getOrCreateKey(): SecretKey {
        val keyStore = KeyStore.getInstance(KEYSTORE).apply { load(null) }
        (keyStore.getEntry(KEY_ALIAS, null) as? KeyStore.SecretKeyEntry)?.let { return it.secretKey }

        val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, KEYSTORE)
        generator.init(
            KeyGenParameterSpec.Builder(
                KEY_ALIAS,
                KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT,
            )
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                // The watch app must refresh in the background and on wake, so
                // requiring user authentication per use would break it.
                .setUserAuthenticationRequired(false)
                .build(),
        )
        return generator.generateKey()
    }
}
