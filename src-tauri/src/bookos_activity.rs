//! Cliente del contrato privado de actividades vivas del escritorio BookOS.

use futures_util::StreamExt;
use serde::Serialize;
use tauri::Emitter;

const DESTINO: &str = "org.bookos.Desktop";
const RUTA: &str = "/org/bookos/Desktop";
const INTERFAZ: &str = "org.bookos.Desktop";

static CONEXION: tokio::sync::OnceCell<zbus::Connection> = tokio::sync::OnceCell::const_new();

async fn conexion() -> Result<&'static zbus::Connection, String> {
    CONEXION
        .get_or_try_init(|| async { zbus::Connection::session().await.map_err(|e| e.to_string()) })
        .await
}

#[tauri::command]
pub async fn bookos_activity_publish(
    app_id: String,
    kind: String,
    state: serde_json::Value,
) -> Result<bool, String> {
    let conn = conexion().await?;
    let proxy = zbus::Proxy::new(conn, DESTINO, RUTA, INTERFAZ)
        .await
        .map_err(|e| e.to_string())?;
    let json = serde_json::to_string(&state).map_err(|e| e.to_string())?;
    proxy
        .call("PublishActivity", &(app_id, kind, json))
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn bookos_activity_close(app_id: String) -> Result<bool, String> {
    let conn = conexion().await?;
    let proxy = zbus::Proxy::new(conn, DESTINO, RUTA, INTERFAZ)
        .await
        .map_err(|e| e.to_string())?;
    proxy
        .call("CloseActivity", &(app_id,))
        .await
        .map_err(|e| e.to_string())
}

#[derive(Clone, Serialize)]
struct ActivityAction {
    action: String,
    value: String,
}

/// Escucha una sola vez y reenvía a WebView únicamente las órdenes dirigidas
/// a esta aplicación. Si el escritorio no está ejecutándose, la app sigue
/// funcionando sin isla.
pub fn listen(app: tauri::AppHandle, app_id: &'static str) {
    tauri::async_runtime::spawn(async move {
        let Ok(conn) = conexion().await else { return; };
        let Ok(proxy) = zbus::Proxy::new(conn, DESTINO, RUTA, INTERFAZ).await else { return; };
        let Ok(mut señales) = proxy.receive_signal("ActivityAction").await else { return; };
        while let Some(mensaje) = señales.next().await {
            let Ok((destino, action, value)) = mensaje.body().deserialize::<(String, String, String)>() else { continue; };
            if destino == app_id {
                let _ = app.emit("bookos://activity-action", ActivityAction { action, value });
            }
        }
    });
}
