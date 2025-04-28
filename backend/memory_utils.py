import gc
import torch
import os

def check_gpu_memory():
    """
    Verifica la memoria GPU disponibile e restituisce un report.
    """
    gpu_info = "N/A"
    if torch.cuda.is_available():
        try:
            # Ottieni informazioni sulla memoria GPU
            t = torch.cuda.get_device_properties(0).total_memory
            r = torch.cuda.memory_reserved(0)
            a = torch.cuda.memory_allocated(0)
            f = t - (r + a)  # memoria libera
            
            gpu_info = {
                "total": t / (1024**3),  # GB
                "reserved": r / (1024**3),  # GB
                "allocated": a / (1024**3),  # GB
                "free": f / (1024**3)  # GB
            }
            
            print(f"GPU Memory: Total {gpu_info['total']:.2f} GB, Free {gpu_info['free']:.2f} GB")
        except Exception as e:
            print(f"Error getting GPU memory info: {e}")
            gpu_info = str(e)
    
    return {
        "gpu": gpu_info,
        "torch_cuda_available": torch.cuda.is_available()
    }

def free_gpu_memory():
    """
    Libera il più possibile la memoria GPU.
    """
    if torch.cuda.is_available():
        print("Clearing CUDA cache to free up memory...")
        torch.cuda.empty_cache()
        gc.collect()
        print("Memory cleared successfully")
        return True
    return False

def offload_model(model):
    """
    Scarica un modello PyTorch dalla memoria.
    """
    try:
        # Sposta modello su CPU prima
        if hasattr(model, 'to'):
            model = model.to('cpu')
        
        # Elimina il modello
        del model
        
        # Forza la pulizia memoria
        gc.collect()
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
            
        return True
    except Exception as e:
        print(f"Error offloading model: {e}")
        return False

def load_whisper_model(model_size="medium"):
    """
    Carica un modello Whisper nella dimensione specificata.
    """
    import whisper
    
    # Forza la pulizia memoria prima di caricare il modello
    gc.collect()
    if torch.cuda.is_available():
        torch.cuda.empty_cache()
    
    # Controllo dispositivo
    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"Loading Whisper '{model_size}' model on {device}...")
    
    try:
        # Carica il modello con il device appropriato
        model = whisper.load_model(model_size, device=device)
        print(f"Whisper model loaded successfully on {device}")
        return model
    except Exception as e:
        print(f"Error loading Whisper model: {e}")
        # Prova a caricare un modello più piccolo in caso di errore
        if model_size != "tiny":
            print("Trying to load a smaller model...")
            return load_whisper_model("tiny")
        return None

def is_enough_memory_for_both_models():
    """
    Verifica se c'è abbastanza memoria per entrambi i modelli (Whisper e LLM)
    """
    if not torch.cuda.is_available():
        return False
    
    memory_info = check_gpu_memory()
    if isinstance(memory_info["gpu"], dict):
        # Se c'è almeno 6GB liberi, dovrebbe essere sufficiente
        return memory_info["gpu"]["free"] > 6.0
    
    return False
