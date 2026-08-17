import { useAppStore } from '@/stores';
import { Button } from './ui/button';
import { Cloud, HardDrive, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

export function ExecutionModeToggle() {
  const { 
    executionMode, 
    setExecutionMode, 
    showCloudConfirmation, 
    setShowCloudConfirmation,
    pendingCloudSwitch,
    setPendingCloudSwitch,
    activeCloudProvider 
  } = useAppStore();
  
  const isCloudMode = executionMode === 'cloud';
  
  const handleToggle = () => {
    if (!isCloudMode) {
      // Switching to cloud - show confirmation
      setPendingCloudSwitch(true);
      setShowCloudConfirmation(true);
    } else {
      // Switching to local - no confirmation needed
      setExecutionMode('local');
    }
  };
  
  const confirmCloudSwitch = () => {
    setExecutionMode('cloud');
    setShowCloudConfirmation(false);
    setPendingCloudSwitch(false);
  };
  
  const cancelCloudSwitch = () => {
    setShowCloudConfirmation(false);
    setPendingCloudSwitch(false);
  };
  
  return (
    <>
      <div 
        className={cn(
          "flex items-center gap-2 p-1 rounded-lg border transition-colors",
          isCloudMode ? "bg-cloud/10 border-cloud" : "bg-background border-border"
        )}
      >
        <Button
          variant={isCloudMode ? "ghost" : "local"}
          size="sm"
          onClick={() => !isCloudMode || setExecutionMode('local')}
          className={cn(
            "gap-1.5",
            !isCloudMode && "shadow-sm"
          )}
        >
          <HardDrive className="h-4 w-4" />
          <span>Local</span>
        </Button>
        
        <Button
          variant={isCloudMode ? "cloud" : "ghost"}
          size="sm"
          onClick={handleToggle}
          className={cn(
            "gap-1.5",
            isCloudMode && "shadow-sm"
          )}
        >
          <Cloud className="h-4 w-4" />
          <span>Cloud</span>
        </Button>
      </div>
      
      {/* Cloud Confirmation Dialog */}
      {showCloudConfirmation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card border rounded-lg shadow-lg p-6 max-w-md mx-4">
            <div className="flex items-start gap-4">
              <div className="p-2 bg-cloud/10 rounded-full">
                <AlertTriangle className="h-6 w-6 text-cloud" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold mb-2">
                  Switch to Cloud Mode?
                </h3>
                <p className="text-muted-foreground text-sm mb-4">
                  Jobs submitted in Cloud mode will consume tokens or credits from your{' '}
                  {activeCloudProvider || 'cloud provider'} account. This may result in charges.
                </p>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={cancelCloudSwitch}>
                    Cancel
                  </Button>
                  <Button variant="cloud" onClick={confirmCloudSwitch}>
                    Continue with Cloud
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}