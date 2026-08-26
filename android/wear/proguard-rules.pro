# minifyEnabled is false for now (matching :app), so these are inert until it is
# turned on. Kept here so enabling R8 later is a one-line change.

# kotlinx-serialization: keep generated serializers and the @Serializable classes
# they reference. Without these, R8 strips them and every parse fails at runtime.
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.**
-keepclassmembers class kotlinx.serialization.json.** {
    *** Companion;
}
-keepclasseswithmembers class kotlinx.serialization.json.** {
    kotlinx.serialization.KSerializer serializer(...);
}
-keep,includedescriptorclasses class com.smartecoenterprise.app.wear.**$$serializer { *; }
-keepclassmembers class com.smartecoenterprise.app.wear.** {
    *** Companion;
}
-keepclasseswithmembers class com.smartecoenterprise.app.wear.** {
    kotlinx.serialization.KSerializer serializer(...);
}

# Retrofit / OkHttp
-dontwarn okhttp3.**
-dontwarn okio.**
-dontwarn retrofit2.**
-keepattributes Signature, Exceptions
-keep,allowobfuscation interface retrofit2.Call
-keep,allowobfuscation class retrofit2.Response
