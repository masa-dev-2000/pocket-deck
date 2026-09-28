!macro customCheckAppRunning
  ; Never terminate a running Pocket Deck, including during npm's silent install.
  nsProcess::_FindProcess /NOUNLOAD "${APP_EXECUTABLE_FILENAME}"
  Pop $R0
  ${if} $R0 == 0
  ${andIf} ${isUpdated}
    ; electron-updater spawns NSIS just before quitting its own process.
    ; Wait for that normal exit, but never fall back to taskkill.
    ${For} $R1 1 20
      Sleep 500
      nsProcess::_FindProcess /NOUNLOAD "${APP_EXECUTABLE_FILENAME}"
      Pop $R0
      ${if} $R0 != 0
        ${ExitFor}
      ${endif}
    ${Next}
  ${endif}
  ${if} $R0 == 0
    ${ifNot} ${Silent}
      MessageBox MB_OK|MB_ICONEXCLAMATION "Pocket Deckを通知領域の終了から完全に終了して、再実行してください。"
    ${endif}
    SetErrorLevel 2
    Quit
  ${endif}
!macroend
