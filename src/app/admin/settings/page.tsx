"use client";

import { useState, useEffect, useRef } from "react";
import { FiSave, FiSettings, FiCalendar, FiLock, FiCheck, FiLoader, FiRefreshCw } from "react-icons/fi";
import { useUserSettings } from "@/hooks/useUserSettings";
import { useNotification } from "@/contexts/NotificationContext";

export default function AdminSettings() {
  const { settings, updateSettings, saveChanges, isLoading, syncStatus, lastSyncMessage } = useUserSettings();
  const { showNotification } = useNotification();
  const [isSaving, setIsSaving] = useState(false);
  const notificationShownRef = useRef<boolean>(false);
  
  // Local state for form controls
  const [preferYearOnlyDateFormat, setPreferYearOnlyDateFormat] = useState(true);
  const [filesVcApiKey, setFilesVcApiKey] = useState("");
  const [isApiKeyModified, setIsApiKeyModified] = useState(false);

  // Load settings when component mounts
  useEffect(() => {
    if (!isLoading && settings) {
      setPreferYearOnlyDateFormat(settings.preferYearOnlyDateFormat ?? true);
      
      // If API key exists in settings, show masked version
      if (settings.filesVcApiKey) {
        setFilesVcApiKey("••••••••••••••••");
      }
    }
  }, [isLoading, settings]);

  // Show notifications when sync status changes, but only once per sync operation
  useEffect(() => {
    console.log('Settings page: syncStatus changed to:', syncStatus, 'with message:', lastSyncMessage);
    console.log('Settings page: notificationShown flag is:', notificationShownRef.current);
    
    if (syncStatus === 'success' && !notificationShownRef.current) {
      notificationShownRef.current = true;
      console.log('Settings page: Showing success notification with message:', lastSyncMessage);
      showNotification('success', lastSyncMessage || 'Settings synchronized successfully');
      setTimeout(() => {
        notificationShownRef.current = false;
        console.log('Settings page: Reset notification flag after timeout');
      }, 5000); // Don't show another success notification for 5 seconds
    } else if (syncStatus === 'error') {
      notificationShownRef.current = true;
      console.log('Settings page: Showing error notification with message:', lastSyncMessage);
      showNotification('error', lastSyncMessage || 'Failed to synchronize settings');
      setTimeout(() => {
        notificationShownRef.current = false;
        console.log('Settings page: Reset notification flag after timeout');
      }, 5000);
    }
  }, [syncStatus, lastSyncMessage, showNotification]);

  const handleApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilesVcApiKey(e.target.value);
    setIsApiKeyModified(true);
  };

  const handleSaveSettings = async () => {
    setIsSaving(true);
    
    try {
      const updatedSettings: Record<string, any> = {
        preferYearOnlyDateFormat,
      };
      
      // Only update API key if it was modified
      if (isApiKeyModified && filesVcApiKey) {
        updatedSettings.filesVcApiKey = filesVcApiKey;
      }
      
      // First just update local state
      await updateSettings(updatedSettings);
      
      // Then explicitly save to server
      await saveChanges();
      
      setIsApiKeyModified(false);
    } catch (error) {
      console.error("Failed to save settings:", error);
      // The error notification will be shown by the useEffect watching syncStatus
    } finally {
      setIsSaving(false);
    }
  };

  // Get sync status indicator
  const getSyncStatusIndicator = () => {
    switch (syncStatus) {
      case 'syncing':
        return (
          <div className="flex items-center text-blue-600 animate-pulse">
            <FiRefreshCw className="mr-1 h-4 w-4 animate-spin" />
            <span>Syncing...</span>
          </div>
        );
      case 'success':
        return (
          <div className="flex items-center text-green-600">
            <FiCheck className="mr-1 h-4 w-4" />
            <span>Synced</span>
          </div>
        );
      case 'error':
        return (
          <div className="flex items-center text-red-600">
            <FiLoader className="mr-1 h-4 w-4" />
            <span>Sync failed</span>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center">
          <FiSettings className="mr-3 h-6 w-6 text-gray-700" />
          <h1 className="text-2xl font-bold text-gray-900">Admin Settings</h1>
        </div>
        {getSyncStatusIndicator()}
      </div>
      
      {isLoading ? (
        <div className="rounded-md bg-gray-50 p-4 text-gray-600">Loading settings...</div>
      ) : (
        <div className="space-y-8">
          {/* Publication Date Format */}
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 flex items-center text-lg font-medium text-gray-900">
              <FiCalendar className="mr-2 h-5 w-5 text-gray-700" />
              Publication Date Format
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="flex items-center justify-between text-sm font-medium text-gray-700">
                  <span>Default Publication Date Format</span>
                  <div 
                    className="relative inline-block h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent bg-gray-200 transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                    onClick={() => {
                      const newValue = !preferYearOnlyDateFormat;
                      setPreferYearOnlyDateFormat(newValue);
                      
                      // Just update local state, don't auto-save
                      updateSettings({ preferYearOnlyDateFormat: newValue });
                    }}
                  >
                    <span
                      className={`${
                        preferYearOnlyDateFormat ? "translate-x-5" : "translate-x-0"
                      } pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
                    />
                  </div>
                </label>
                <p className="mt-1 text-sm text-gray-500">
                  {preferYearOnlyDateFormat ? "Year Only (YYYY)" : "Full Date (YYYY-MM-DD)"}
                </p>
                <p className="mt-1 text-xs text-gray-400">
                  This setting affects how publication dates are displayed and entered in book forms.
                </p>
              </div>
            </div>
          </div>
          
          {/* Files.vc API Key */}
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 flex items-center text-lg font-medium text-gray-900">
              <FiLock className="mr-2 h-5 w-5 text-gray-700" />
              Files.vc Integration
            </h2>
            
            <div className="space-y-4">
              <div>
                <label htmlFor="apiKey" className="mb-1 block text-sm font-medium text-gray-700">
                  API Key
                </label>
                <input
                  type="password"
                  id="apiKey"
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  placeholder={isApiKeyModified ? "Enter new API key" : "Enter API key or leave unchanged"}
                  value={filesVcApiKey}
                  onChange={handleApiKeyChange}
                />
                <p className="mt-1 text-xs text-gray-400">
                  {!isApiKeyModified && settings?.filesVcApiKey 
                    ? "API key is saved and encrypted. Leave blank to keep the existing key." 
                    : "Your API key will be stored securely and encrypted."}
                </p>
              </div>
            </div>
          </div>
          
          {/* Save Button and Status */}
          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={handleSaveSettings}
              disabled={isSaving || syncStatus === 'syncing'}
              className={`inline-flex items-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                (isSaving || syncStatus === 'syncing') ? "cursor-not-allowed opacity-75" : ""
              }`}
            >
              {(isSaving || syncStatus === 'syncing') ? (
                <>
                  <FiRefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <FiSave className="mr-2 h-4 w-4" />
                  Save Settings
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}