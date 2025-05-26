'use client';

import { useState, useEffect } from 'react';
import { FiKey, FiSave, FiAlertTriangle, FiCheckCircle, FiXCircle } from 'react-icons/fi';
import gsap from 'gsap';

// const LOCAL_STORAGE_KEY_FILES_VC = 'filesVcApiKey'; // No longer using localStorage directly for saving

export default function SettingsPage() {
  const [filesVcApiKey, setFilesVcApiKey] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [isFilesVcKeySet, setIsFilesVcKeySet] = useState<boolean | null>(null); // null = unknown, true = set, false = not set
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Check if API key is set on mount
  useEffect(() => {
    const checkApiKeyStatus = async () => {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        console.log("Checking API key status...");
        const response = await fetch(`/api/admin/settings/api-keys?serviceName=files_vc`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          // Include credentials to ensure cookies are sent for authentication
          credentials: 'include'
        });
        
        console.log("API response status:", response.status);
        
        if (response.ok) {
          const data = await response.json();
          console.log("API response data:", data);
          setIsFilesVcKeySet(data.isSet);
        } else {
          let errorData;
          try {
            errorData = await response.json();
            console.error("API error response:", errorData);
          } catch (e) {
            console.error("Could not parse error response as JSON");
            errorData = { 
              error: `HTTP Error: ${response.status} ${response.statusText}`,
              details: "The server returned an error response that could not be parsed as JSON"
            };
          }
          
          // Improved error message that includes both the main error and details if available
          const errorMsg = errorData?.error || `HTTP Error: ${response.status} ${response.statusText}`;
          const errorDetails = errorData?.details ? ` - ${errorData.details}` : '';
          
          setErrorMessage(`${errorMsg}${errorDetails}`);
          console.error("Failed to check API key status:", errorMsg, errorDetails);
          setIsFilesVcKeySet(false); // Assume not set on error
        }
      } catch (error) {
        const errorDetail = error instanceof Error ? error.message : String(error);
        setErrorMessage(`Error checking API key status: ${errorDetail}`);
        console.error("Error checking API key status:", error);
        setIsFilesVcKeySet(false); // Assume not set on error
      } finally {
        setIsLoading(false);
      }
    };
    checkApiKeyStatus();
  }, []);

  // GSAP Animations
  useEffect(() => {
    if (!isLoading) { // Run animations only after loading is complete
      gsap.fromTo(
        '.settings-card',
        { y: 20, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.5, ease: 'power2.out', stagger: 0.1 }
      );
    }
  }, [isLoading]);

  const handleSaveFilesVcApiKey = async () => {
    if (!filesVcApiKey.trim()) {
      alert("API Key cannot be empty."); // Basic validation
      return;
    }
    setSaveStatus('saving');
    setErrorMessage(null);
    try {
      const response = await fetch('/api/admin/settings/api-keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include credentials for authentication
        body: JSON.stringify({ 
          serviceName: 'files_vc', 
          apiKey: filesVcApiKey 
        }),
      });

      let responseData;
      try {
        responseData = await response.json();
      } catch (e: unknown) {
        const errorMsg = e instanceof Error ? e.message : String(e);
        throw new Error(`Failed to parse response: ${errorMsg}. The server may have returned a non-JSON response.`);
      }

      if (response.ok) {
        console.log("API key saved successfully:", responseData);
        setSaveStatus('success');
        setIsFilesVcKeySet(true); // Assume key is now set
        setTimeout(() => setSaveStatus('idle'), 2000);
      } else {
        // Improved error message handling with more details
        const errorMsg = responseData?.error || response.statusText || 'Unknown error';
        const errorDetails = responseData?.details ? ` - ${responseData.details}` : '';
        
        setErrorMessage(`${errorMsg}${errorDetails}`);
        console.error("Error saving Files.vc API key:", errorMsg, errorDetails);
        setSaveStatus('error');
        setTimeout(() => setSaveStatus('idle'), 3000);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      setErrorMessage(errorMessage);
      console.error("Error saving Files.vc API key:", error);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  };

  if (isLoading && isFilesVcKeySet === null) { // Show loading only during initial check
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-gray-500">Loading settings status...</p>
        {/* You could add a spinner here */}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold text-gray-900 settings-card">Admin Settings</h1>

      {/* Security Warning Banner - Remains important */}
      <div className="settings-card rounded-md bg-red-50 p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <FiAlertTriangle className="h-5 w-5 text-red-400" aria-hidden="true" />
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">Security Notice: API Key Management</h3>
            <div className="mt-2 text-sm text-red-700">
              <p>
                This system is designed to store API keys encrypted in a backend database (e.g., Neon).
                Ensure your backend API route for saving keys (`/api/admin/settings/api-keys`) implements proper authentication and secure database storage.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Error message display - Enhanced with more details and troubleshooting instructions */}
      {errorMessage && (
        <div className="settings-card rounded-md bg-red-50 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <FiXCircle className="h-5 w-5 text-red-400" aria-hidden="true" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{errorMessage}</p>
                <p className="mt-2">
                  Please make sure you are logged in as an admin user and that your database is properly set up.
                </p>
                <div className="mt-3 text-xs bg-red-100 p-2 rounded">
                  <p className="font-medium">Troubleshooting:</p>
                  <ul className="list-disc list-inside mt-1">
                    <li>Check that your API_ENCRYPTION_KEY is set in the .env.local file (64-character hex)</li>
                    <li>Verify your database connection is working (check DATABASE_URL)</li>
                    <li>Ensure you have the ADMIN role in the database</li>
                    <li>Check server logs for more details</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="settings-card rounded-lg bg-white p-6 shadow-md">
        <h2 className="mb-6 text-xl font-semibold text-gray-800">File Host API Keys</h2>
        
        <div className="space-y-6">
          {/* Files.vc API Key Setting */}
          <div>
            <div className="mb-2 flex items-center justify-between">
                <label htmlFor="filesVcApiKey" className="flex items-center text-sm font-medium text-gray-700">
                <FiKey className="mr-2 h-4 w-4 text-gray-500" />
                Files.vc API Key
                </label>
                {isFilesVcKeySet !== null && (
                    <span className={`flex items-center text-xs font-medium px-2 py-0.5 rounded-full ${isFilesVcKeySet ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}> 
                        {isFilesVcKeySet ? <FiCheckCircle className="mr-1 h-3 w-3"/> : <FiAlertTriangle className="mr-1 h-3 w-3"/>}
                        {isFilesVcKeySet ? 'Key is Set' : 'Key Not Set'}
                    </span>
                )}
            </div>
            <p className="mb-2 text-xs text-gray-500">
              Enter your Files.vc API key. This key will be encrypted and stored securely.
            </p>
            <div className="flex items-center space-x-3">
              <input
                type="password" 
                id="filesVcApiKey"
                className="mt-1 block w-full flex-grow rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                placeholder={isFilesVcKeySet ? "Key is set (Enter new key to update)" : "Enter your Files.vc API Key"}
                value={filesVcApiKey}
                onChange={(e) => setFilesVcApiKey(e.target.value)}
              />
              <button
                type="button"
                onClick={handleSaveFilesVcApiKey}
                disabled={saveStatus === 'saving'}
                className={`inline-flex items-center justify-center rounded-md border border-transparent px-4 py-2 text-sm font-medium text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2
                  ${saveStatus === 'saving' ? 'bg-gray-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500'}
                  ${saveStatus === 'success' ? 'bg-green-500 hover:bg-green-600' : ''}
                  ${saveStatus === 'error' ? 'bg-red-500 hover:bg-red-600' : ''}`}
              >
                <FiSave className="mr-2 h-4 w-4" />
                {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'success' ? 'Saved!' : saveStatus === 'error' ? 'Error!' : (isFilesVcKeySet ? 'Update Key' : 'Save Key')}
              </button>
            </div>
            {saveStatus === 'success' && <p className="mt-1 text-sm text-green-600">Files.vc API Key action processed successfully.</p>}
            {saveStatus === 'error' && <p className="mt-1 text-sm text-red-600">Failed to process API Key. See error message above for details.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}