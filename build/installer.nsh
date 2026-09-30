; 起動時に「インストール / 修復 / アンインストール」を選ばせる。
; 修復とアンインストールは、同じアプリが既にあるときだけ選べる。

!ifndef BUILD_UNINSTALLER
Var NovelRepair
Var MaintenanceInstall
Var MaintenanceRepair
Var MaintenanceUninstall
!endif

!macro customWelcomePage
  Page custom MaintenanceCreate MaintenanceLeave
  !define MUI_PAGE_CUSTOMFUNCTION_SHOW MaintenanceDirShow
!macroend

!macro customHeader
  !ifndef BUILD_UNINSTALLER
    Function MaintenanceCreate
      StrCpy $NovelRepair "0"
      !insertmacro MUI_HEADER_TEXT "操作の選択" "インストール、修復、アンインストールから選びます。"
      nsDialogs::Create 1018
      Pop $0
      ${If} $0 == error
        Abort
      ${EndIf}

      ${NSD_CreateLabel} 0 0 100% 28u "「$(^Name)」の操作を選んでください。"
      Pop $0

      ${If} $hasPerUserInstallation == "1"
      ${OrIf} $hasPerMachineInstallation == "1"
        ${NSD_CreateLabel} 0 20u 100% 24u "このパソコンには既にインストールされています。修復かアンインストールも選べます。"
        Pop $0
      ${Else}
        ${NSD_CreateLabel} 0 20u 100% 24u "まだインストールされていません。インストールを選んで次へ進んでください。"
        Pop $0
      ${EndIf}

      ${NSD_CreateRadioButton} 12u 48u 100% 14u "インストール"
      Pop $MaintenanceInstall
      ${NSD_CreateRadioButton} 12u 66u 100% 14u "修復（今の場所へ入れ直す）"
      Pop $MaintenanceRepair
      ${NSD_CreateRadioButton} 12u 84u 100% 14u "アンインストール"
      Pop $MaintenanceUninstall

      ${If} $hasPerUserInstallation == "1"
      ${OrIf} $hasPerMachineInstallation == "1"
        ${NSD_SetState} $MaintenanceRepair ${BST_CHECKED}
      ${Else}
        ${NSD_SetState} $MaintenanceInstall ${BST_CHECKED}
        EnableWindow $MaintenanceRepair 0
        EnableWindow $MaintenanceUninstall 0
      ${EndIf}

      nsDialogs::Show
    FunctionEnd

    Function MaintenanceLeave
      ${NSD_GetState} $MaintenanceUninstall $0
      ${If} $0 == ${BST_CHECKED}
        Call MaintenanceRunUninstaller
        Quit
      ${EndIf}

      ${NSD_GetState} $MaintenanceRepair $0
      ${If} $0 == ${BST_CHECKED}
        StrCpy $NovelRepair "1"
        ${If} $hasPerUserInstallation == "1"
          StrCpy $INSTDIR $perUserInstallationFolder
        ${ElseIf} $hasPerMachineInstallation == "1"
          StrCpy $INSTDIR $perMachineInstallationFolder
        ${EndIf}
      ${EndIf}
    FunctionEnd

    Function MaintenanceRunUninstaller
      StrCpy $R2 ""
      ReadRegStr $R2 HKCU "${UNINSTALL_REGISTRY_KEY}" UninstallString
      ${If} $R2 == ""
        ReadRegStr $R2 HKLM "${UNINSTALL_REGISTRY_KEY}" UninstallString
      ${EndIf}
      ${If} $R2 == ""
        MessageBox MB_ICONEXCLAMATION|MB_OK "アンインストーラが見つかりません。Windowsの「アプリ」から削除してください。"
        Abort
      ${EndIf}
      HideWindow
      ExecWait $R2
    FunctionEnd

    Function MaintenanceDirShow
      ${If} $NovelRepair != "1"
        Return
      ${EndIf}
      GetDlgItem $0 $HWNDPARENT 1019
      ${If} $0 == 0
        Return
      ${EndIf}
      System::Call 'user32::PostMessage(p $HWNDPARENT, i 0x111, p 1, p 0)'
    FunctionEnd
  !endif
!macroend
