# Mantem a interface JS-Android exposta na WebView (se vier a ser usada).
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# WebView publica callbacks via reflexao em alguns dispositivos antigos.
-keepclassmembers class * extends android.webkit.WebViewClient {
    public void *(android.webkit.WebView, java.lang.String);
    public boolean *(android.webkit.WebView, java.lang.String);
}
