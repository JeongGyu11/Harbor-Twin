FROM python:3.12-slim
WORKDIR /app
COPY observation_server.py ai_assistant.py ./
COPY dist ./dist
RUN useradd --create-home appuser && mkdir /data && chown appuser /data
USER appuser
ENV HOST=0.0.0.0 PORT=8000 DATA_DIR=/data PYTHONUNBUFFERED=1
EXPOSE 8000
CMD ["python", "observation_server.py"]
