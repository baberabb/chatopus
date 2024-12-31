import { useEffect, useState, useRef } from 'react';
import type { PyodideInterface } from 'pyodide';

// Declare loadPyodide as a global function since we'll load it from CDN
declare global {
  interface Window {
    loadPyodide: (config: {
      indexURL: string;
      stdout?: (text: string) => void;
      stderr?: (text: string) => void;
    }) => Promise<PyodideInterface>;
  }
}

export const usePyodide = () => {
  const [pyodide, setPyodide] = useState<PyodideInterface | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initialized = useRef(false);

  const loadPyodide = async (): Promise<PyodideInterface | null> => {
    if (initialized.current) return pyodide;
    if (isLoading) return null;
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Load Pyodide script
      const script = document.createElement('script');
      const isProd = import.meta.env.PROD;
      
      // Use local assets in production, CDN in development
      script.src = isProd 
        ? "/assets/pyodide.asm.js"
        : "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js";
      
      await new Promise((resolve, reject) => {
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });

      console.log('Loading Pyodide...');
      const pyodideInstance = await window.loadPyodide({
        indexURL: isProd
          ? "/assets/"
          : "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/",
        stdout: (text) => {
          console.log('Python stdout:', text);
        },
        stderr: (text) => {
          console.error('Python stderr:', text);
        }
      });
      console.log('Pyodide loaded successfully');
      
      // Initialize sys for handling stdout
      await pyodideInstance.runPythonAsync(`
        import sys
        import io
        sys.stdout = io.StringIO()
      `);
      
      initialized.current = true;
      setPyodide(pyodideInstance);
      return pyodideInstance;
    } catch (err) {
      console.error('Failed to initialize Pyodide:', err);
      setError(err instanceof Error ? err.message : String(err));
      initialized.current = false;
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const executePython = async (code: string): Promise<{ output: string; success: boolean }> => {
    let instance = pyodide;
    
    // Load Pyodide if not already loaded
    if (!instance) {
      instance = await loadPyodide();
      if (!instance) {
        return {
          output: 'Failed to initialize Pyodide',
          success: false
        };
      }
    }

    try {
      // Clear previous stdout content
      await instance.runPythonAsync('sys.stdout.seek(0)\nsys.stdout.truncate(0)');
      
      // Execute the code
      const result = await instance.runPythonAsync(code);
      
      // Get stdout content
      const stdout = await instance.runPythonAsync('sys.stdout.getvalue()');
      
      // Handle the result carefully
      let resultStr = '';
      if (result !== undefined && result !== null) {
        try {
          resultStr = result.toString();
          // Don't add the result if it's just 'None'
          if (resultStr === 'None') {
            resultStr = '';
          }
        } catch (err) {
          console.warn('Could not convert result to string:', err);
        }
      }
      
      // Combine stdout with result if available
      const output = stdout.trim() + (resultStr ? '\n' + resultStr : '');
      
      return {
        output: output || 'No output',
        success: true
      };
    } catch (err) {
      console.error('Python execution error:', err);
      return {
        output: err instanceof Error ? err.message : String(err),
        success: false
      };
    }
  };

  return {
    pyodide,
    isLoading,
    error,
    executePython
  };
};
