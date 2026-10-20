package by.mtbank.mobyfamily

import android.annotation.SuppressLint
import android.content.Intent
import android.os.Bundle
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import androidx.activity.ComponentActivity
import androidx.activity.addCallback
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewClientCompat

/**
 * Оболочка модуля «Семья в Moby». Веб-модуль (module/web, сборка в docs/) лежит в APK
 * и открывается с локального адреса, поэтому приложение работает без интернета,
 * а данные семьи хранятся на устройстве.
 */
class MainActivity : ComponentActivity() {
    private lateinit var web: WebView

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        super.onCreate(savedInstanceState)

        // https://appassets.androidplatform.net/assets/… → файлы из src/main/assets (то есть docs/)
        val assets = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()

        web = WebView(this).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.mediaPlaybackRequiresUserGesture = true
            settings.userAgentString = "${settings.userAgentString} MobyFamilyApp/${BuildConfig.VERSION_NAME}"
            webViewClient = object : WebViewClientCompat() {
                override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? =
                    assets.shouldInterceptRequest(request.url)?.withWasmMime(request)

                override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                    if (request.url.host == APP_HOST) return false
                    startActivity(Intent(Intent.ACTION_VIEW, request.url)) // внешние ссылки — в браузер
                    return true
                }
            }
        }
        setContentView(web)

        if (savedInstanceState != null) web.restoreState(savedInstanceState)
        else web.loadUrl("https://$APP_HOST/assets/index.html")

        // «Назад»: сначала закрываем шторку или экран внутри модуля, иначе выходим
        onBackPressedDispatcher.addCallback(this) {
            web.evaluateJavascript("window.mobyBack ? window.mobyBack() : false") { handled ->
                if (handled != "true") finish()
            }
        }

        UpdateChecker.check(this)
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        web.saveState(outState)
    }

    override fun onDestroy() {
        web.destroy()
        super.onDestroy()
    }

    companion object {
        const val APP_HOST = "appassets.androidplatform.net"
    }
}

/** SQLite в модуле — WebAssembly; браузеру нужен точный MIME-тип .wasm */
private fun WebResourceResponse.withWasmMime(request: WebResourceRequest): WebResourceResponse {
    if (request.url.path?.endsWith(".wasm") == true) mimeType = "application/wasm"
    return this
}
