# Listing extraction API (FastAPI + Docling OCR + Gemini). Build context: server/
FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    HF_HOME=/opt/models/huggingface

# OpenCV (used by the OCR engine) needs these shared libraries.
RUN apt-get update \
    && apt-get install --yes --no-install-recommends libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
# CPU-only PyTorch for Docling's layout model; the default wheels bundle large GPU libraries.
RUN pip install torch==2.14.0 torchvision==0.29.0 --index-url https://download.pytorch.org/whl/cpu
COPY requirements.txt ./
RUN pip install -r requirements.txt
COPY . .

# Download the OCR and layout models at build time, then run offline.
RUN python -c "from extensions.ext_ocr import build_converter; build_converter()" \
    && chmod -R a+rX /opt/models
ENV HF_HUB_OFFLINE=1

RUN useradd --system --uid 10001 --no-create-home app \
    && mkdir -p /app/data && chown app /app/data
USER app

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=3s --start-period=30s --retries=3 \
    CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/healthz', timeout=2)"]

# One worker process: the rate limiter counts per process, and OCR models are loaded once per process.
# Behind a trusted proxy, set FORWARDED_ALLOW_IPS so client IPs come from X-Forwarded-For.
CMD ["uvicorn", "app:create_app", "--factory", "--host", "0.0.0.0", "--port", "8000", "--no-access-log"]
