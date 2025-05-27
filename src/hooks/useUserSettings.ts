import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';

export interface UserSettings {
  preferYearOnlyDateFormat: boolean;
  filesVcApiKey?: string; // Add API key property (optional)
  // Add other user settings here as needed
}

// Add a SyncStatus type to track synchronization state
export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error';

interface UseUserSettingsReturn {
  settings: UserSettings | null;
  updateSettings: (newSettings: Partial<UserSettings>) => Promise<void>;
  isLoading: boolean;
  error: Error | null;
  syncStatus: SyncStatus;
  lastSyncMessage: string;
  // Add method to manually sync pending changes
  saveChanges: () => Promise<void>;
}

export const useUserSettings = (): UseUserSettingsReturn => {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [lastSyncMessage, setLastSyncMessage] = useState<string>('');
  // Track pending changes separately
  const [pendingChanges, setPendingChanges] = useState<Partial<UserSettings> | null>(null);
  
  // Use a ref to prevent excessive notifications
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSyncTimeRef = useRef<number>(0);
  const router = useRouter();

  // Load settings from API when the hook mounts
  useEffect(() => {
    const loadSettings = async () => {
      console.log('==== useUserSettings: Starting to load settings ====');
      setIsLoading(true);
      setSyncStatus('syncing');
      setLastSyncMessage('Loading settings from database...');
      
      try {
        console.log('useUserSettings: Fetching settings from API');
        // Fetch settings from API
        const response = await fetch('/api/admin/settings', {
          cache: 'no-store', // Prevent caching
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        });
        console.log('useUserSettings: API response status:', response.status);
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.log('useUserSettings: API error response:', errorData);
          
          // Handle authentication errors specifically
          if (response.status === 401) {
            console.warn('useUserSettings: Authentication issue - user not logged in or session expired');
            throw new Error(
              `Authentication required: ${errorData.error || 'You need to be logged in to access your settings'}`
            );
          } else {
            throw new Error(
              `Failed to load settings: ${response.status} ${response.statusText}${
                errorData.error ? ' - ' + errorData.error : ''
              }`
            );
          }
        }
        
        const data = await response.json();
        console.log('useUserSettings: API data received:', { 
          hasData: !!data, 
          preferYearOnlyDateFormat: data?.preferYearOnlyDateFormat,
          hasApiKey: !!data?.filesVcApiKey
        });
        
        // If API call succeeds but we still don't have settings, use defaults
        if (!data) {
          console.log('useUserSettings: No data from API, using defaults');
          setSettings({
            preferYearOnlyDateFormat: true
          });
          setSyncStatus('success');
          setLastSyncMessage('Using default settings (no saved preferences found)');
        } else {
          console.log('useUserSettings: Using data from API');
          setSettings(data);
          setSyncStatus('success');
          setLastSyncMessage('Settings loaded successfully');
        }
      } catch (err) {
        console.error('useUserSettings: Error loading settings:', err);
        setError(err instanceof Error ? err : new Error('Unknown error loading settings'));
        setSyncStatus('error');
        
        // Create more specific error message
        let errorMessage = 'Unknown error';
        if (err instanceof Error) {
          if (err.message.includes('Authentication required')) {
            errorMessage = 'Using default settings (login required for personalized settings)';
          } else {
            errorMessage = err.message;
          }
        }
        setLastSyncMessage(`Failed to load settings: ${errorMessage}`);
        console.log('useUserSettings: Error message set to:', errorMessage);
        
        // Fallback to defaults on error
        console.log('useUserSettings: Falling back to defaults due to error');
        setSettings({
          preferYearOnlyDateFormat: true
        });
        
        // For development fallback to localStorage if API fails
        if (process.env.NODE_ENV === 'development') {
          try {
            const savedSettings = localStorage.getItem('userSettings');
            if (savedSettings) {
              console.log('useUserSettings: Found settings in localStorage');
              setSettings(JSON.parse(savedSettings));
              setLastSyncMessage('Settings loaded from browser storage (database unavailable)');
            }
          } catch (e) {
            console.error('useUserSettings: Fallback to localStorage failed:', e);
          }
        }
      } finally {
        console.log('useUserSettings: Finished loading settings, status =', syncStatus);
        setIsLoading(false);
        // Reset sync status after a short delay
        if (syncTimeoutRef.current) {
          clearTimeout(syncTimeoutRef.current);
        }
        syncTimeoutRef.current = setTimeout(() => {
          setSyncStatus('idle');
        }, 3000);
        console.log('==== useUserSettings: Settings load process complete ====');
      }
    };

    loadSettings();
    
    return () => {
      // Clear timeout on unmount
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, []);

  // Function to save changes to the API
  const saveToApi = useCallback(async (changesObj: Partial<UserSettings>): Promise<void> => {
    const now = Date.now();
    // Debounce API calls to prevent too many requests
    if (now - lastSyncTimeRef.current < 2000) {
      return;
    }
    
    lastSyncTimeRef.current = now;
    setSyncStatus('syncing');
    setLastSyncMessage('Saving changes to database...');
    
    try {
      // Log what we're trying to save for debugging
      console.log('Attempting to save settings:', 
        { ...changesObj, filesVcApiKey: changesObj.filesVcApiKey ? '[REDACTED]' : undefined }
      );
      
      // Save settings to API
      const response = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(changesObj),
        // Add credentials to ensure cookies are sent
        credentials: 'include'
      });
      
      // Get the response data for better error messages
      const responseData = await response.json().catch(() => ({}));
      
      if (!response.ok) {
        // Create a user-friendly error message based on status code
        let errorMessage = responseData.error || 'Unknown error';
        
        if (response.status === 401) {
          errorMessage = 'You need to be logged in to save settings';
        } else if (response.status === 403) {
          errorMessage = 'You do not have permission to update these settings';
        } else if (response.status === 409) {
          errorMessage = 'Conflict with existing settings';
        } else if (response.status === 500) {
          errorMessage = `Server error: ${responseData.error || 'Internal server error'}`;
          // In development, attempt to diagnose database connection issues
          if (process.env.NODE_ENV === 'development') {
            console.error('Possible database connection issue or schema mismatch');
            
            // Save to localStorage as a fallback in development
            localStorage.setItem('userSettings', JSON.stringify({
              ...settings,
              ...changesObj
            }));
            errorMessage += ' (Changes saved to local storage as fallback)';
          }
        }
        
        throw new Error(`Failed to update settings: ${response.status} ${response.statusText} - ${errorMessage}`);
      }
      
      // If we get here, the request was successful
      
      // Reset pending changes
      setPendingChanges(null);
      
      setSyncStatus('success');
      setLastSyncMessage(responseData.message || 'Settings saved to database successfully');
      
      // For development, also save to localStorage as backup
      if (process.env.NODE_ENV === 'development') {
        localStorage.setItem('userSettings', JSON.stringify({
          ...settings,
          ...changesObj
        }));
      }
    } catch (err) {
      console.error('Error updating user settings:', err);
      setError(err instanceof Error ? err : new Error('Failed to update settings'));
      setSyncStatus('error');
      
      // Create a more user-friendly error message
      let displayMessage = 'Failed to save settings';
      if (err instanceof Error) {
        displayMessage = err.message;
        
        // Check for common errors and provide more helpful messages
        if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
          displayMessage = 'Network error: Please check your internet connection';
        } else if (err.message.includes('database')) {
          displayMessage = 'Database error: Your settings could not be saved';
        }
      }
      
      setLastSyncMessage(displayMessage);
      
      throw err;
    } finally {
      // Reset sync status after a delay
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
      syncTimeoutRef.current = setTimeout(() => {
        setSyncStatus('idle');
      }, 3000);
    }
  }, [settings]);

  // Update settings - this now queues changes but doesn't save immediately
  const updateSettings = useCallback((newSettings: Partial<UserSettings>): Promise<void> => {
    if (!settings) return Promise.resolve();
    
    // Update local state immediately
    setSettings(prevSettings => ({
      ...prevSettings!,
      ...newSettings
    }));
    
    // Queue changes for later saving
    setPendingChanges(prev => ({
      ...prev,
      ...newSettings
    }));
    
    return Promise.resolve();
  }, [settings]);

  // Manual save function
  const saveChanges = useCallback(async (): Promise<void> => {
    if (!pendingChanges || !settings) return;
    
    await saveToApi(pendingChanges);
  }, [pendingChanges, settings, saveToApi]);

  return {
    settings,
    updateSettings,
    isLoading,
    error,
    syncStatus,
    lastSyncMessage,
    saveChanges
  };
}; 