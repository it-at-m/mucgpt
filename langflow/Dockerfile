FROM langflowai/langflow:latest
# Set working directory
WORKDIR /app
# Copy your modified astradb_graph.py file
#COPY src/backend/base/langflow/components/vectorstores/astradb_graph.py /tmp/astradb_graph.py
# Find the site-packages directory where langflow is installed
#RUN python -c "import site; print(site.getsitepackages()[0])" > /tmp/site_packages.txt
# Replace the file in the site-packages location
#RUN SITE_PACKAGES=$(cat /tmp/site_packages.txt) && \
#    echo "Site packages at: $SITE_PACKAGES" && \
#    mkdir -p "$SITE_PACKAGES/langflow/components/vectorstores" && \
#    cp /tmp/astradb_graph.py "$SITE_PACKAGES/langflow/components/vectorstores/"
# Clear Python cache in the site-packages directory only
#RUN SITE_PACKAGES=$(cat /tmp/site_packages.txt) && \
##    find "$SITE_PACKAGES" -name "*.pyc" -delete && \
 #   find "$SITE_PACKAGES" -name "__pycache__" -type d -exec rm -rf {} +
# Expose the default Langflow port
EXPOSE 7860
# Command to run Langflow
CMD ["python", "-m", "langflow", "run", "--host", "0.0.0.0", "--port", "7860"]