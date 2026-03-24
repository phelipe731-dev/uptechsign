FROM python:3.12-slim

# Install LibreOffice writer (headless)
RUN apt-get update && \
    apt-get install -y --no-install-recommends libreoffice-writer-nogui && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Run migrations and start server
CMD ["sh", "-c", "python -m alembic upgrade head && python seed.py && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
