# CUDA runtime for SDXL LoRA training and inference
FROM pytorch/pytorch:2.3.0-cuda12.1-cudnn8-devel

WORKDIR /app

# System deps needed by some python packages and kohya_ss
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Install kohya_ss training scripts
RUN git clone --depth 1 https://github.com/bmaltais/kohya_ss.git /kohya_ss \
    && pip install --no-cache-dir \
        -r /kohya_ss/requirements.txt \
        lion-pytorch==0.0.6 \
    || true
# (some kohya deps may conflict; we install ours next and let pip resolve)

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Configure accelerate for single-GPU/non-interactive use
RUN mkdir -p /root/.cache/huggingface/accelerate && \
    printf 'compute_environment: LOCAL_MACHINE\ndistributed_type: NO\nfp16: true\nmachine_rank: 0\nmain_process_ip: null\nmain_process_port: null\nnum_machines: 1\nnum_processes: 1\nuse_cpu: false\n' \
    > /root/.cache/huggingface/accelerate/default_config.yaml

COPY . .

CMD ["rq", "worker", "--url", "redis://redis:6379/0", "--with-scheduler"]
