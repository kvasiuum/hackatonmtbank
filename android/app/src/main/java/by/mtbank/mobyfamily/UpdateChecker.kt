package by.mtbank.mobyfamily

import android.app.Activity
import android.app.AlertDialog
import android.content.Intent
import android.net.Uri
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

/**
 * Быстрые обновления: CI на каждый пуш публикует релиз build-N с APK.
 * При запуске приложение сравнивает N со своим versionCode и предлагает скачать новую сборку.
 * Все сборки подписаны одним ключом, поэтому обновление ставится поверх, данные сохраняются.
 */
object UpdateChecker {
    private val io = Executors.newSingleThreadExecutor()

    fun check(activity: Activity) {
        io.execute {
            val latest = runCatching { fetchLatest() }.getOrNull() ?: return@execute
            if (latest.build <= BuildConfig.VERSION_CODE) return@execute
            activity.runOnUiThread {
                if (activity.isFinishing) return@runOnUiThread
                AlertDialog.Builder(activity)
                    .setTitle("Доступно обновление")
                    .setMessage("Сборка ${latest.build} (у вас ${BuildConfig.VERSION_CODE}). Скачать и установить?")
                    .setPositiveButton("Скачать") { _, _ ->
                        activity.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(latest.apkUrl)))
                    }
                    .setNegativeButton("Позже", null)
                    .show()
            }
        }
    }

    private data class Release(val build: Int, val apkUrl: String)

    private fun fetchLatest(): Release? {
        val conn = URL("https://api.github.com/repos/${BuildConfig.UPDATE_REPO}/releases/latest").openConnection() as HttpURLConnection
        conn.connectTimeout = 5000
        conn.readTimeout = 5000
        conn.setRequestProperty("Accept", "application/vnd.github+json")
        try {
            if (conn.responseCode != 200) return null // приватный репозиторий или релизов ещё нет
            val json = JSONObject(conn.inputStream.bufferedReader().readText())
            val build = json.getString("tag_name").removePrefix("build-").toIntOrNull() ?: return null
            val assets = json.getJSONArray("assets")
            for (i in 0 until assets.length()) {
                val a = assets.getJSONObject(i)
                if (a.getString("name").endsWith(".apk")) return Release(build, a.getString("browser_download_url"))
            }
            return null
        } finally {
            conn.disconnect()
        }
    }
}
