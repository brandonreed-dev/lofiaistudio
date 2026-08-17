import { useModelStore, useAppStore } from '@/stores';
import { Button } from './ui/button';
import { ChevronDown, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import type { Modality } from '@lofiaistudio/shared';

interface ModelSelectorProps {
  modality?: Modality;
}

export function ModelSelector({ modality: propModality }: ModelSelectorProps) {
  const { activeModality } = useAppStore();
  const { models, selectedModel, setSelectedModel, fetchModels, isLoading } = useModelStore();
  
  const modality = propModality || activeModality;
  const modalityModels = models[modality];
  const currentModel = selectedModel[modality];
  const [isOpen, setIsOpen] = useState(false);
  
  const handleRefresh = () => {
    fetchModels(modality);
  };
  
  const selectedModelData = modalityModels.find(m => m.id === currentModel);
  
  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-md border bg-background",
            "hover:bg-accent transition-colors min-w-[200px]",
            isLoading && "opacity-50"
          )}
          disabled={isLoading}
        >
          <span className="flex-1 text-left truncate">
            {selectedModelData?.name || 'Select a model'}
          </span>
          <ChevronDown className={cn(
            "h-4 w-4 transition-transform",
            isOpen && "rotate-180"
          )} />
        </button>
        
        <Button
          variant="ghost"
          size="icon"
          onClick={handleRefresh}
          disabled={isLoading}
          title="Refresh models"
        >
          <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
        </Button>
      </div>
      
      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute top-full left-0 mt-1 w-full min-w-[200px] bg-card border rounded-md shadow-lg z-20 max-h-60 overflow-auto">
            {modalityModels.length === 0 ? (
              <div className="px-3 py-2 text-muted-foreground text-sm">
                No models available
              </div>
            ) : (
              modalityModels.map((model) => (
                <button
                  key={model.id}
                  onClick={() => {
                    setSelectedModel(modality, model.id);
                    setIsOpen(false);
                  }}
                  className={cn(
                    "w-full px-3 py-2 text-left hover:bg-accent transition-colors",
                    model.id === currentModel && "bg-accent"
                  )}
                >
                  <div className="font-medium truncate">{model.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {model.runtime} • {model.status}
                  </div>
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}