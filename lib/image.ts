export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }

      reject(new Error("Failed to convert file to data URL."));
    };

    reader.onerror = () => {
      reject(new Error("Failed to read file."));
    };

    reader.readAsDataURL(file);
  });
}

type CompressOptions = {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
};

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to load image for compression."));
    image.src = src;
  });
}

export async function compressImageDataUrl(
  dataUrl: string,
  options: CompressOptions = {}
): Promise<string> {
  if (typeof window === "undefined") {
    return dataUrl;
  }

  if (!dataUrl.startsWith("data:image/")) {
    return dataUrl;
  }

  const maxWidth = options.maxWidth ?? 1024;
  const maxHeight = options.maxHeight ?? 1024;
  const quality = options.quality ?? 0.75;

  try {
    const image = await loadImage(dataUrl);

    const ratio = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
    const width = Math.max(1, Math.round(image.width * ratio));
    const height = Math.max(1, Math.round(image.height * ratio));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) {
      return dataUrl;
    }

    context.drawImage(image, 0, 0, width, height);
    const compressed = canvas.toDataURL("image/jpeg", quality);

    return compressed.length < dataUrl.length ? compressed : dataUrl;
  } catch {
    return dataUrl;
  }
}

export function slugify(value: string): string {
  const base = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return base || "comic-page";
}
