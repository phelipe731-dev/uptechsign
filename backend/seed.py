"""Seed script: create admin user and import existing templates."""

import asyncio
import sys
from pathlib import Path

# Ensure the backend package is importable
sys.path.insert(0, str(Path(__file__).parent))

from sqlalchemy import select

from app.config import settings
from app.database import async_session
from app.models.template import Template
from app.models.user import User
from app.services.auth_service import create_user


# Helper: field definition
def f(key, label, display_label, required=True, order=0):
    return {
        "key": key,
        "label": label,           # exact placeholder in DOCX: [label]
        "display_label": display_label,  # friendly UI label
        "required": required,
        "display_order": order,
    }


async def seed():
    async with async_session() as db:
        # --- Admin user ---
        result = await db.execute(select(User).where(User.email == "admin@detter.adv.br"))
        if not result.scalar_one_or_none():
            await create_user(db, "admin@detter.adv.br", "Daniel Detter", "Admin123", "admin")
            print("Admin criado: admin@detter.adv.br / Admin123")
        else:
            print("Admin já existe.")

        # --- Templates ---
        # NOTE: 'label' must match the exact text inside [...] in the DOCX template.
        # 'display_label' is what is shown in the form UI.
        # When the same label appears multiple times (positional), list fields in order.

        templates = [
            {
                "name": "Procuração",
                "slug": "procuracao",
                "description": "Procuração ad judicia et extra com poderes especiais",
                "file_path": "PROCURACAO_MODELO.docx",
                "fields": [
                    f("nome_menor", "NOME DO MENOR/INCAPAZ",      "Nome do Menor / Incapaz",       True,  1),
                    f("nascimento", "Data de Nascimento",           "Data de Nascimento",            True,  2),
                    # [nº do RG] appears twice: 1st = menor, 2nd = representante
                    f("rg_menor",  "nº do RG",                     "RG do Menor",                   True,  3),
                    # [nº do CPF] appears twice: 1st = menor, 2nd = representante
                    f("cpf_menor", "nº do CPF",                    "CPF do Menor",                  True,  4),
                    f("nome_rep",  "NOME DA REPRESENTANTE LEGAL",   "Nome da Representante Legal",   True,  5),
                    f("estado_civil", "estado civil",               "Estado Civil",                  True,  6),
                    f("profissao", "profissão",                     "Profissão",                     True,  7),
                    f("rg_rep",    "nº do RG",                     "RG da Representante",           True,  8),
                    f("cpf_rep",   "nº do CPF",                    "CPF da Representante",          True,  9),
                    f("endereco",  "Endereço completo com CEP",     "Endereço Completo com CEP",     True, 10),
                    f("email",     "e-mail do advogado",            "E-mail do Advogado",            True, 11),
                ],
            },
            {
                "name": "Contrato de Honorários",
                "slug": "contrato",
                "description": "Contrato de prestação de serviços advocatícios",
                "file_path": "HONORARIOS_ATUALIZADO.docx",
                "fields": [
                    f("nome_menor",  "NOME DO MENOR/INCAPAZ",      "Nome do Menor / Incapaz",       True,  1),
                    f("nascimento",  "Data de Nascimento",           "Data de Nascimento",            True,  2),
                    # [nº do RG] 1st = menor
                    f("rg_menor",   "nº do RG",                     "RG do Menor",                   True,  3),
                    # [nº do CPF] 1st = menor
                    f("cpf_menor",  "nº do CPF",                    "CPF do Menor",                  True,  4),
                    f("nome_rep",   "NOME DA REPRESENTANTE LEGAL",   "Nome da Representante Legal",   True,  5),
                    f("estado_civil","estado civil",                 "Estado Civil",                  True,  6),
                    f("profissao",  "profissão",                     "Profissão",                     True,  7),
                    # [nº do RG] 2nd = representante
                    f("rg_rep",     "nº do RG",                     "RG da Representante",           True,  8),
                    # [nº do CPF] 2nd = representante
                    f("cpf_rep",    "nº do CPF",                    "CPF da Representante",          True,  9),
                    f("endereco",   "Endereço completo com CEP",     "Endereço Completo com CEP",     True, 10),
                    f("cidade",     "Cidade",                        "Cidade",                        True, 11),
                    f("data_dia",   "data",                          "Dia",                           True, 12),
                    f("mes",        "mês",                           "Mês",                           True, 13),
                    f("ano",        "ano",                           "Ano",                           True, 14),
                    f("email",      "e-mail do advogado",            "E-mail do Advogado",            True, 15),
                    # [NOME] 1st = testemunha 1
                    f("test1_nome", "NOME",                         "Testemunha 1 — Nome",           True, 16),
                    # [RG] 1st = testemunha 1
                    f("test1_rg",   "RG",                           "Testemunha 1 — RG",             True, 17),
                    # [NOME] 2nd = testemunha 2
                    f("test2_nome", "NOME",                         "Testemunha 2 — Nome",           True, 18),
                    # [RG] 2nd = testemunha 2
                    f("test2_rg",   "RG",                           "Testemunha 2 — RG",             True, 19),
                ],
            },
        ]

        for tpl_data in templates:
            result = await db.execute(select(Template).where(Template.slug == tpl_data["slug"]))
            tpl = result.scalar_one_or_none()
            if not tpl:
                tpl = Template(**tpl_data)
                db.add(tpl)
                print(f"Template criado: {tpl_data['name']}")
            else:
                # Upsert: update fields to fix labels / display_labels
                tpl.name = tpl_data["name"]
                tpl.description = tpl_data.get("description")
                tpl.file_path = tpl_data["file_path"]
                tpl.fields = tpl_data["fields"]
                print(f"Template atualizado: {tpl_data['name']}")

        await db.commit()

    print("\nSeed completo!")


if __name__ == "__main__":
    asyncio.run(seed())
