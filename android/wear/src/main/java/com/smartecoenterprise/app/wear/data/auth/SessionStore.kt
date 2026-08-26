package com.smartecoenterprise.app.wear.data.auth

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.Json

private val Context.dataStore: DataStore<Preferences> by preferencesDataStore(name = "smarteco_wear")

/**
 * Persists the session as one encrypted blob.
 *
 * The email is stored separately in PLAINTEXT on purpose: it pre-fills the login
 * screen so the user only has to type a password on a watch keyboard. It is not
 * a secret, and keeping it outside the encrypted blob means it survives a
 * keystore key rotation that invalidates the token.
 */
class SessionStore(private val context: Context) {

    private val json = Json { ignoreUnknownKeys = true }

    val session: Flow<Session?> = context.dataStore.data.map { prefs ->
        prefs[KEY_SESSION]?.let { blob ->
            CryptoBox.decrypt(blob)?.let { plain ->
                try {
                    json.decodeFromString<Session>(plain)
                } catch (e: Exception) {
                    null // Shape changed across versions — treat as signed out.
                }
            }
        }
    }

    val lastEmail: Flow<String> = context.dataStore.data.map { it[KEY_LAST_EMAIL].orEmpty() }

    suspend fun save(session: Session) {
        val blob = CryptoBox.encrypt(json.encodeToString(session))
        context.dataStore.edit { prefs ->
            prefs[KEY_SESSION] = blob
            prefs[KEY_LAST_EMAIL] = session.email
        }
    }

    /** Clears the session but deliberately keeps the email for re-login. */
    suspend fun clear() {
        context.dataStore.edit { prefs -> prefs.remove(KEY_SESSION) }
    }

    suspend fun current(): Session? = session.first()

    /**
     * Blocking read for the OkHttp interceptor, which runs on OkHttp's own
     * background threads and has no coroutine scope. Never call from the main
     * thread.
     */
    fun currentBlocking(): Session? = runBlocking { current() }

    private companion object {
        val KEY_SESSION = stringPreferencesKey("session")
        val KEY_LAST_EMAIL = stringPreferencesKey("last_email")
    }
}
