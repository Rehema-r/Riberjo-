import React, { useState, useCallback } from 'react';
import Cropper, { Area, Point } from 'react-easy-crop';
import { X, RotateCw, RotateCcw, Check, Scissors } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ImageCropperProps {
  image: string;
  onCropComplete: (croppedImage: string) => void;
  onCancel: () => void;
  aspect?: number;
  circular?: boolean;
}

export default function ImageCropper({ 
  image, 
  onCropComplete, 
  onCancel, 
  aspect = 1, 
  circular = false 
}: ImageCropperProps) {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  const onCropChange = (crop: Point) => {
    setCrop(crop);
  };

  const onZoomChange = (zoom: number) => {
    setZoom(zoom);
  };

  const onRotationChange = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const onRotationCcwChange = () => {
    setRotation((prev) => (prev - 90 + 360) % 360);
  };

  const onCropCompleteInternal = useCallback((_croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const createImage = (url: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const image = new Image();
      image.addEventListener('load', () => resolve(image));
      image.addEventListener('error', (error) => reject(error));
      image.setAttribute('crossOrigin', 'anonymous');
      image.src = url;
    });

  const getCroppedImg = async (
    imageSrc: string,
    pixelCrop: Area,
    rotation = 0
  ): Promise<string> => {
    const image = await createImage(imageSrc);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      return '';
    }

    const rotRad = (rotation * Math.PI) / 180;
    const { width: bBoxWidth, height: bBoxHeight } = rotateSize(
      image.width,
      image.height,
      rotation
    );

    // set canvas size to match the bounding box
    canvas.width = bBoxWidth;
    canvas.height = bBoxHeight;

    // translate canvas context to a central point to allow rotating and flipping around the center
    ctx.translate(bBoxWidth / 2, bBoxHeight / 2);
    ctx.rotate(rotRad);
    ctx.translate(-image.width / 2, -image.height / 2);

    // draw rotated image
    ctx.drawImage(image, 0, 0);

    // croppedAreaPixels values are bounding box relative
    // extract the cropped image using these values
    const data = ctx.getImageData(
      pixelCrop.x,
      pixelCrop.y,
      pixelCrop.width,
      pixelCrop.height
    );

    // set canvas width to final desired crop size - this will clear existing context
    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;

    // paste generated rotate image with correct offsets for x,y crop values.
    ctx.putImageData(data, 0, 0);

    // As Base64 string
    return canvas.toDataURL('image/jpeg');
  };

  function rotateSize(width: number, height: number, rotation: number) {
    const rotRad = (rotation * Math.PI) / 180;

    return {
      width:
        Math.abs(Math.cos(rotRad) * width) + Math.abs(Math.sin(rotRad) * height),
      height:
        Math.abs(Math.sin(rotRad) * width) + Math.abs(Math.cos(rotRad) * height),
    };
  }

  const handleDone = async () => {
    if (croppedAreaPixels) {
      try {
        const croppedImage = await getCroppedImg(image, croppedAreaPixels, rotation);
        onCropComplete(croppedImage);
      } catch (e) {
        console.error(e);
      }
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm"
    >
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
      >
        <div className="p-6 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 rounded-lg">
              <Scissors size={20} />
            </div>
            <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">Ajuster la photo</h3>
          </div>
          <button 
            onClick={onCancel}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-all"
          >
            <X size={20} />
          </button>
        </div>

        <div className="relative flex-1 bg-slate-50 dark:bg-slate-950 min-h-[300px] md:min-h-[400px]">
          <Cropper
            image={image}
            crop={crop}
            zoom={zoom}
            rotation={rotation}
            aspect={aspect}
            cropShape={circular ? 'round' : 'rect'}
            showGrid={true}
            onCropChange={onCropChange}
            onCropComplete={onCropCompleteInternal}
            onZoomChange={onZoomChange}
          />
        </div>

        <div className="p-6 space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Zoom</span>
              <span className="text-[10px] font-black text-slate-900 dark:text-white">{Math.round(zoom * 100)}%</span>
            </div>
            <input
              type="range"
              value={zoom}
              min={1}
              max={3}
              step={0.1}
              aria-labelledby="Zoom"
              onChange={(e) => onZoomChange(Number(e.target.value))}
              className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-600"
            />
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="flex gap-2">
              <button
                onClick={onRotationCcwChange}
                className="p-3 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-all"
                title="Pivoter à gauche"
              >
                <RotateCcw size={16} />
              </button>
              <button
                onClick={onRotationChange}
                className="p-3 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-all"
                title="Pivoter à droite"
              >
                <RotateCw size={16} />
              </button>
            </div>

            <div className="flex flex-1 gap-2">
              <button
                onClick={onCancel}
                className="flex-1 py-4 text-slate-500 dark:text-slate-400 text-[10px] font-black uppercase tracking-widest hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 rounded-2xl transition-all"
              >
                Annuler
              </button>
              <button
                onClick={handleDone}
                className="flex-[2] py-4 bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-emerald-700 shadow-xl shadow-emerald-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <Check size={16} />
                Confirmer & Enregistrer
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
