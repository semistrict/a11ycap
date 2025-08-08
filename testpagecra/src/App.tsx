import React, { useState } from 'react';
import * as A11yCap from 'a11ycap';
import './App.css';

// Initialize React DevTools inline for testpage
// @ts-ignore
import('react-devtools-inline').then((devtools: any) => {
  devtools.initialize(window);
  (window as any).reactDevToolsReady = true;
});

function App() {
  const [count, setCount] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [selectedOption, setSelectedOption] = useState('');
  const [hoverMessage, setHoverMessage] = useState('');
  const [keyPressed, setKeyPressed] = useState('');
  const [waitMessage, setWaitMessage] = useState('');

  React.useEffect(() => {
    // Expose A11yCap globally for tests
    (window as any).A11yCap = A11yCap;
    console.log('🐱 Test page ready - A11yCap exposed globally');
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
      
      <button onClick={() => setShowForm(!showForm)} id="show-form-button">
        {showForm ? 'Hide Form' : 'Show Form'}
      </button>

      {/* Hover test element */}
      <div 
        id="hover-target"
        onMouseEnter={() => setHoverMessage('Mouse entered!')}
        onMouseLeave={() => setHoverMessage('')}
        style={{ 
          padding: '10px', 
          border: '1px solid #ccc', 
          margin: '10px 0',
          backgroundColor: hoverMessage ? '#f0f0f0' : 'white'
        }}
      >
        Hover over me! {hoverMessage && <span>({hoverMessage})</span>}
      </div>

      {/* Key press test element */}
      <div id="key-press-display" style={{ margin: '10px 0' }}>
        Last key pressed: <strong>{keyPressed || 'None'}</strong>
      </div>
      
      <input 
        id="key-test-input"
        type="text"
        placeholder="Focus and press keys here"
        onKeyDown={(e) => setKeyPressed(e.key)}
        style={{ margin: '10px 0', display: 'block' }}
      />

      {/* Select dropdown for testing */}
      <div style={{ margin: '10px 0' }}>
        <label htmlFor="test-select">Choose an option:</label>
        <select 
          id="test-select"
          value={selectedOption}
          onChange={(e) => setSelectedOption(e.target.value)}
        >
          <option value="">Select...</option>
          <option value="option1">Option 1</option>
          <option value="option2">Option 2</option>
          <option value="option3">Option 3</option>
        </select>
        {selectedOption && <span> Selected: {selectedOption}</span>}
      </div>

      {/* Wait test buttons */}
      <div style={{ margin: '10px 0' }}>
        <button 
          onClick={() => {
            setWaitMessage('Loading...');
            setTimeout(() => setWaitMessage('Loading complete!'), 2000);
          }}
        >
          Start Loading (2s delay)
        </button>
        <button 
          onClick={() => setWaitMessage('')}
        >
          Clear Message
        </button>
        <div id="wait-message">
          {waitMessage}
        </div>
      </div>

      {/* Dedicated test element for size limit tests */}
      <div id="size-test-container" style={{ margin: '10px 0', padding: '10px', border: '1px solid #eee' }}>
        <h3>Size Test Section</h3>
        <p>This is a dedicated section for testing size limits.</p>
        <ul>
          <li>Item 1</li>
          <li>Item 2</li>
          <li>Item 3</li>
        </ul>
        <button>Test Button</button>
      </div>
      
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

export default App;
