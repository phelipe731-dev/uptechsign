# Uptech Sign — Gerador de Documentos
### Guia de Instalação e Uso

---

## O que é este programa

Aplicativo desktop para geração automática de PDFs jurídicos (Procuração e
Contrato de Honorários) com preenchimento automático dos campos variáveis.

---

## Pré-requisitos

Antes de gerar o .exe, instale no computador Windows:

### 1. Python 3.10 ou superior
- Baixe em: https://www.python.org/downloads/
- **IMPORTANTE:** Durante a instalação, marque ✅ "Add Python to PATH"

### 2. LibreOffice (para converter .docx → PDF)
- Baixe em: https://www.libreoffice.org/download/download/
- Instale normalmente (Next → Next → Finish)
- O programa detecta automaticamente

---

## Como gerar o .exe

1. Coloque esta pasta em qualquer lugar do computador
2. Copie seus documentos modelo para a pasta `docs\`:
   - `docs\PROCURACAO_MODELO.docx`
   - `docs\HONORARIOS_ATUALIZADO.docx`
3. Dê duplo clique em **BUILD.bat**
4. Aguarde — o .exe será criado em `dist\Detter_Gerador_Documentos.exe`

> O processo leva cerca de 1–2 minutos na primeira vez.

---

## Distribuição

Após gerar o .exe, você pode:
- Copiar `dist\Detter_Gerador_Documentos.exe` para qualquer computador Windows
- Criar um atalho na Área de Trabalho
- **Não precisa** instalar Python nos outros computadores — mas **precisa** do LibreOffice

---

## Usando o programa

1. Selecione o documento: Procuração + Contrato / Só Procuração / Só Contrato
2. Preencha os dados do cliente
3. Escolha a pasta de destino (padrão: Desktop\Documentos_Detter)
4. Clique em **GERAR DOCUMENTOS**
5. Os PDFs aparecem listados — clique em "Abrir" ou "Abrir pasta"

---

## Campos reconhecidos automaticamente

| Campo no documento | Campo no formulário |
|--------------------|---------------------|
| `[NOME DO MENOR/INCAPAZ]` | Nome do Menor |
| `[Data de Nascimento]` | Data de Nascimento |
| `[nº do RG]` (1ª ocorr.) | RG do Menor |
| `[nº do CPF]` (1ª ocorr.) | CPF do Menor |
| `[NOME DA REPRESENTANTE LEGAL]` | Nome da Representante |
| `[estado civil]` | Estado Civil |
| `[profissão]` | Profissão |
| `[nº do RG]` (2ª ocorr.) | RG da Representante |
| `[nº do CPF]` (2ª ocorr.) | CPF da Representante |
| `[Endereço completo com CEP]` | Endereço |
| `[e-mail do advogado]` | E-mail (procuração) |
| `[Cidade]` / `[data]` / `[mês]` / `[ano]` | Data do contrato |
| `[NOME]` / `[RG]` (testemunhas) | Testemunha 1 e 2 |

---

## Atualizar os modelos de documento

Para atualizar os documentos .docx (quando houver mudanças no contrato):

1. Substitua os arquivos em `docs\`
2. Rode `BUILD.bat` novamente para gerar novo .exe

**Regra:** qualquer texto entre `[` e `]` é tratado como campo variável.

---

## Problemas comuns

**"LibreOffice não encontrado"**
→ Instale o LibreOffice: https://www.libreoffice.org/download/download/

**"python-docx não instalado"**
→ Execute no terminal: `pip install python-docx`

**PDF não abre**
→ Verifique se tem um leitor de PDF instalado (Adobe Reader, Edge, etc.)

---

*Daniel Cunha Detter — OAB/SP 258.095*
*Alameda Santos, 1827, Cj. 112 — Cerqueira Cesar — São Paulo/SP*
