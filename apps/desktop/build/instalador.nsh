; "Abrir com o Prumo" no botão direito de pastas (RN-76), só no instalador por usuário (.exe).
; A mesma chave pode ser ligada ou desligada nas Preferências do programa.

!macro customInstall
  WriteRegStr HKCU "Software\Classes\Directory\shell\Prumo" "" "Abrir com o Prumo"
  WriteRegStr HKCU "Software\Classes\Directory\shell\Prumo" "Icon" '"$INSTDIR\Prumo.exe",0'
  WriteRegStr HKCU "Software\Classes\Directory\shell\Prumo\command" "" '"$INSTDIR\Prumo.exe" "%1"'
!macroend

!macro customUnInstall
  DeleteRegKey HKCU "Software\Classes\Directory\shell\Prumo"
!macroend
