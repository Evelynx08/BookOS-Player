# Maintainer: local build — instala BookOS Player desde el checkout actual del repo.
# No pensado para AUR: usa el código tal cual está en este directorio, no descarga nada.
pkgname=bookos-player
pkgver=0.6.1
pkgrel=1
pkgdesc="BookOS Player — reproductor de música"
arch=('x86_64')
url="https://github.com/Evelynx08/BookOS-Player"
license=('MIT')
depends=('webkit2gtk-4.1' 'gtk3' 'gst-plugins-base' 'gst-plugins-good' 'gst-plugins-bad')
# El binario de tauri-cli (cargo-tauri) se asume ya instalado vía `cargo install`,
# no como paquete de pacman — por eso no está en makedepends.
makedepends=('rust')
options=('!strip')

build() {
  cd "$startdir"
  cargo tauri build --no-bundle
}

package() {
  cd "$startdir"
  install -Dm755 "src-tauri/target/release/bookos-player" "$pkgdir/usr/bin/bookos-player"
  install -Dm644 "src-tauri/icons/icon.png" "$pkgdir/usr/share/icons/hicolor/256x256/apps/bookos-player.png"
  install -Dm644 /dev/stdin "$pkgdir/usr/share/applications/bookos-player.desktop" <<-EOF
	[Desktop Entry]
	Name=Reproductor - Player
	Comment=BookOS Player
	Exec=bookos-player
	Icon=bookos-player
	Terminal=false
	Type=Application
	Categories=AudioVideo;Audio;Player;
	StartupWMClass=bookos-player
	EOF
}
