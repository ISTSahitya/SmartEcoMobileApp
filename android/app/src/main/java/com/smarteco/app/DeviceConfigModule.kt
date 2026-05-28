package com.smarteco.app

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.ReadableMapKeySetIterator
import com.facebook.react.bridge.ReadableType
import org.json.JSONArray
import org.json.JSONObject
import android.util.Log
import java.io.BufferedReader
import java.io.InputStreamReader
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import kotlin.concurrent.thread

class DeviceConfigModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "DeviceConfigModule"

    @ReactMethod
    fun send(url: String, payload: ReadableMap, timeout: Int, promise: Promise) {
        thread {
            try {
                val jsonPayload = readableMapToJson(payload)
                Log.d("DeviceConfigModule", "send_start url=$url body=${jsonPayload}")
                val connection = (URL(url).openConnection() as HttpURLConnection).apply {
                    requestMethod = "POST"
                    connectTimeout = timeout
                    readTimeout = timeout
                    doOutput = true
                    setRequestProperty("Content-Type", "application/json")
                    setRequestProperty("Accept", "application/json, text/plain, */*")
                }

                OutputStreamWriter(connection.outputStream, Charsets.UTF_8).use { writer ->
                    writer.write(jsonPayload.toString())
                    writer.flush()
                }

                val status = connection.responseCode
                val stream = if (status in 200..299) connection.inputStream else connection.errorStream
                val response = stream?.let {
                    BufferedReader(InputStreamReader(it, Charsets.UTF_8)).use { reader ->
                        reader.readText()
                    }
                } ?: ""
                Log.d("DeviceConfigModule", "send_response status=$status length=${response.length} body=$response")

                val result = com.facebook.react.bridge.Arguments.createMap().apply {
                    putInt("status", status)
                    putString("response", response)
                    putString("requestBody", jsonPayload.toString())
                    putString("url", url)
                }
                connection.disconnect()
                promise.resolve(result)
            } catch (error: Exception) {
                promise.reject("device_request_failed", error.message ?: "Device request failed", error)
            }
        }
    }

    private fun readableMapToJson(map: ReadableMap): JSONObject {
        val json = JSONObject()
        val iterator: ReadableMapKeySetIterator = map.keySetIterator()
        while (iterator.hasNextKey()) {
            val key = iterator.nextKey()
            when (map.getType(key)) {
                ReadableType.Null -> json.put(key, JSONObject.NULL)
                ReadableType.Boolean -> json.put(key, map.getBoolean(key))
                ReadableType.Number -> json.put(key, map.getDouble(key))
                ReadableType.String -> json.put(key, map.getString(key))
                ReadableType.Map -> json.put(key, readableMapToJson(map.getMap(key)!!))
                ReadableType.Array -> json.put(key, readableArrayToJson(map.getArray(key)!!))
            }
        }
        return json
    }

    private fun readableArrayToJson(array: ReadableArray): JSONArray {
        val json = JSONArray()
        for (index in 0 until array.size()) {
            when (array.getType(index)) {
                ReadableType.Null -> json.put(JSONObject.NULL)
                ReadableType.Boolean -> json.put(array.getBoolean(index))
                ReadableType.Number -> json.put(array.getDouble(index))
                ReadableType.String -> json.put(array.getString(index))
                ReadableType.Map -> json.put(readableMapToJson(array.getMap(index)!!))
                ReadableType.Array -> json.put(readableArrayToJson(array.getArray(index)!!))
            }
        }
        return json
    }
}
