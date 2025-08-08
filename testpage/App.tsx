import React, { useState } from 'react';
import { snapshotForAI, snapshot, waitForReactDevTools } from '@pwsnapshot/lib';

// Initialize React DevTools inline for testpage
import('react-devtools-inline').then((devtools) => {
  devtools.initialize(window);
  (window as any).reactDevToolsReady = true;
});

export default function App() {
  const [count, setCount] = useState(0);
  const [showForm, setShowForm] = useState(false);

  React.useEffect(() => {
    (window as any).snapshotForAI = snapshotForAI;
    (window as any).snapshot = snapshot;
    (window as any).testReady = true;
  }, []);

  return (
    <div>
      <h1>React Test Page</h1>
      <button 
        id="test-button"
        onClick={() => setCount(count + 1)}
      >
        Click me ({count})
      </button>
      
      <button onClick={() => setShowForm(!showForm)}>
        {showForm ? 'Hide Form' : 'Show Form'}
      </button>
      
      {showForm && (
        <form id="test-form">
          <div>
            <label htmlFor="name">Name:</label>
            <input 
              type="text" 
              id="name"
              name="name"
              placeholder="Enter your name"
            />
          </div>
          <div>
            <label htmlFor="email">Email:</label>
            <input 
              type="email" 
              id="email"
              name="email"
              placeholder="Enter your email"
            />
          </div>
          <button 
            type="submit"
            onClick={(e) => {
              e.preventDefault();
              alert('Form submitted!');
            }}
          >
            Submit
          </button>
        </form>
      )}
    </div>
  );
}