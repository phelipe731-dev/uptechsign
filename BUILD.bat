@echo off
:: ============================================================
::  BUILD — Uptech Sign — Gerador de Documentos
::  Execute este arquivo no Windows para gerar o .exe
:: ============================================================

echo.
echo  ============================================================
echo   UPTECH SIGN — Build do Executavel
echo  ============================================================
echo.

:: 1. Verifica Python
python --version >nul 2>&1
if errorlevel 1 (
    echo  [ERRO] Python nao encontrado.
    echo  Baixe em: https://www.python.org/downloads/
    echo  Marque "Add Python to PATH" durante a instalacao.
    pause & exit /b 1
)

:: 2. Instala dependências
echo  [1/3] Instalando dependencias...
pip install python-docx pyinstaller --quiet
if errorlevel 1 (
    echo  [ERRO] Falha ao instalar dependencias.
    pause & exit /b 1
)

:: 3. Copia os documentos modelo para a pasta docs/
echo  [2/3] Preparando arquivos...
if not exist "docs" mkdir docs

:: Copie seus arquivos .docx para a pasta docs/ antes de rodar este script
:: PROCURACAO_MODELO.docx e HONORARIOS_ATUALIZADO.docx

if not exist "docs\PROCURACAO_MODELO.docx" (
    echo  [AVISO] docs\PROCURACAO_MODELO.docx nao encontrado.
    echo  Copie o arquivo para a pasta docs\ e rode novamente.
)
if not exist "docs\HONORARIOS_ATUALIZADO.docx" (
    echo  [AVISO] docs\HONORARIOS_ATUALIZADO.docx nao encontrado.
    echo  Copie o arquivo para a pasta docs\ e rode novamente.
)

:: 4. Gera o .exe
echo  [3/3] Compilando executavel...
pyinstaller ^
    --onefile ^
    --windowed ^
    --name "Uptech_Sign" ^
    --add-data "docs;docs" ^
    --add-data "assets;assets" ^
    --icon "assets\icon.ico" ^
    app.py

if errorlevel 1 (
    echo.
    echo  [ERRO] Falha na compilacao.
    pause & exit /b 1
)

echo.
echo  ============================================================
echo   Executavel gerado em: dist\Uptech_Sign.exe
echo  ============================================================
echo.
pause
