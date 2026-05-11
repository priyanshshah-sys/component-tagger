import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createVitePlugin } from '../src/plugins/vitePlugin';

const MOCKED_CWD = 'project';

describe('vite-plugin-component-tagger', () => {
  let cwdSpy: ReturnType<typeof vi.spyOn>; // To hold the spy reference

  beforeEach(() => {
    // --- Setup the mock before each test ---
    // Spy on process.cwd and mock its return value
    cwdSpy = vi.spyOn(process, 'cwd');
    cwdSpy.mockReturnValue(MOCKED_CWD);
  });

  afterEach(() => {
    // --- Clean up the mock after each test ---
    // Restore the original implementation
    vi.restoreAllMocks(); // or cwdSpy.mockRestore();
  });

  const mockCode = `
    import React from 'react';
    function App() {
      return (
        <div className="container">
          <span title="example">Hello</span>
        </div>
      );
    }
    export default App;
  `;

  const mockTestCode = `
    import React from 'react';
    describe('App', () => {
      it('renders', () => {
        expect(<div>Test</div>).toBeDefined();
      });
    });
  `;

  it('should tag JSX elements with default options', async () => {
    const plugin = createVitePlugin();
    const result = await (plugin.transform as Function)(
      mockCode,
      'project/src/App.jsx',
    );

    expect(result).toBeDefined();
    expect(result.code).toContain('data-component-id="src/App.jsx:5:8" ');
    expect(result.code).toContain('data-component-path="src/App.jsx" ');
    expect(result.code).toContain('data-component-line="5" ');
    expect(result.code).toContain('data-component-file="App.jsx" ');
    expect(result.code).toContain('data-component-name="div" ');
    expect(result.code).toContain('data-component-content="');
    expect(result.map).toBeDefined();
  });

  it('should skip files in node_modules by default', async () => {
    const plugin = createVitePlugin();
    const result = await (plugin.transform as Function)(
      mockCode,
      'project/node_modules/lib/App.jsx',
    );

    expect(result).toBeNull();
  });

  it('should process node_modules when processNodeModules is true', async () => {
    const plugin = createVitePlugin({ processNodeModules: true });
    const result = await (plugin.transform as Function)(
      mockCode,
      'project/node_modules/lib/App.jsx',
    );

    expect(result).toBeDefined();
    expect(result.code).toContain('data-component-id="');
  });

  it('should exclude files in specified directories', async () => {
    const plugin = createVitePlugin({ excludeDirectories: ['/src/excluded'] });
    const result = await (plugin.transform as Function)(
      mockCode,
      'project/src/excluded/App.jsx',
    );

    expect(result).toBeNull();
  });

  it('should skip test files by default', async () => {
    const plugin = createVitePlugin();
    const result = await (plugin.transform as Function)(
      mockTestCode,
      'project/src/App.test.jsx',
    );

    expect(result).toBeNull();
  });

  it('should not include legacy attributes when includeLegacyAttributes is false', async () => {
    const plugin = createVitePlugin({ includeLegacyAttributes: false });
    const result = await (plugin.transform as Function)(
      mockCode,
      'project/src/App.jsx',
    );

    expect(result).toBeDefined();
    expect(result.code).toContain('data-component-id="');
    expect(result.code).not.toContain('data-component-path="');
    expect(result.code).not.toContain('data-component-line="');
    expect(result.code).not.toContain('data-component-file="');
    expect(result.code).not.toContain('data-component-name="');
  });

  it('should not include content attribute when includeContentAttribute is false', async () => {
    const plugin = createVitePlugin({ includeContentAttribute: false });
    const result = await (plugin.transform as Function)(
      mockCode,
      'project/src/App.jsx',
    );

    expect(result).toBeDefined();
    expect(result.code).toContain('data-component-id="');
    expect(result.code).not.toContain('data-component-content="');
  });

  it('should truncate content attribute when exceeding maxContentLength', async () => {
    const plugin = createVitePlugin({ maxContentLength: 10 });
    const result = await (plugin.transform as Function)(
      mockCode,
      'project/src/App.jsx',
    );

    expect(result).toBeDefined();
    expect(result.code).toContain('data-component-content="');
    expect(result.code.match(/data-component-content="([^"]*)"/)[1]).toMatch(
      /^\S{10}\.\.\.$/,
    );
  });

  it('should use custom attribute prefix', async () => {
    const plugin = createVitePlugin({ attributePrefix: 'data-custom' });
    const result = await (plugin.transform as Function)(
      mockCode,
      'project/src/App.jsx',
    );

    expect(result).toBeDefined();
    expect(result.code).toContain('data-custom-id="');
    expect(result.code).toContain('data-custom-path="');
  });

  it('should use custom generateComponentId function', async () => {
    const customId = 'custom-id-123';
    const plugin = createVitePlugin({
      generateComponentId: () => customId,
    });
    const result = await (plugin.transform as Function)(
      mockCode,
      'project/src/App.jsx',
    );

    expect(result).toBeDefined();
    expect(result.code).toContain(`data-component-id="${customId}"`);
  });

  it('should not generate source maps when sourceMaps is false', async () => {
    const plugin = createVitePlugin({ sourceMaps: false });
    const result = await (plugin.transform as Function)(
      mockCode,
      'project/src/App.jsx',
    );

    expect(result).toBeDefined();
    expect(result.map).toBeNull();
  });

  it('should handle parsing errors gracefully', async () => {
    const invalidCode = '<div>Invalid JSX';
    const plugin = createVitePlugin();
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    const result = await (plugin.transform as Function)(
      invalidCode,
      'project/src/App.jsx',
    );

    expect(result).toBeNull();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringMatching(/Error processing file .+App\.jsx:?/),
      expect.any(Error),
    );
    consoleErrorSpy.mockRestore();
  });

  it('should log verbose messages when verbose is true', async () => {
    const plugin = createVitePlugin({ verbose: true });
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    (plugin.buildStart as Function)();
    await (plugin.transform as Function)(mockCode, 'project/src/App.jsx');
    (plugin.buildEnd as Function)();

    // eslint-disable-next-line no-control-regex
    const stripAnsi = (str: string) => str.replace(/\u001b\[\d+m/g, '');
    const calls = consoleLogSpy.mock.calls.map((c) => stripAnsi(String(c[0])));

    expect(calls).toEqual(
      expect.arrayContaining([
        expect.stringContaining(
          '[component-tagger] Component tagger plugin started',
        ),
        expect.stringContaining(
          '[component-tagger] Processing file: src/App.jsx',
        ),
        expect.stringContaining('[component-tagger] Tagged'),
        expect.stringContaining('Total files scanned:'),
      ]),
    );
  });

  it('should only process specified extensions', async () => {
    const plugin = createVitePlugin({ extensions: ['.jsx'] });
    const jsxResult = await (plugin.transform as Function)(
      mockCode,
      'project/src/App.jsx',
    );
    const tsResult = await (plugin.transform as Function)(
      mockCode,
      'project/src/App.ts',
    );

    expect(jsxResult).toBeDefined();
    expect(tsResult).toBeNull();
  });

  it('should process files without Three.js imports normally', async () => {
    const normalCode = `
      import React from 'react';
      import { useState } from 'react';

      function App() {
        const [count, setCount] = useState(0);
        return (
          <div>
            <button onClick={() => setCount(count + 1)}>
              Count: {count}
            </button>
          </div>
        );
      }
      export default App;
    `;

    const plugin = createVitePlugin();
    const result = await (plugin.transform as Function)(
      normalCode,
      'project/src/App.jsx',
    );

    expect(result).toBeDefined();
    expect(result.code).toContain('data-component-id="');
    expect(result.code).toContain('data-component-name="div"');
  });

  it('should tag reusable components and their usages', async () => {
    const buttonComponentCode = `
      import React from 'react';
      export const Button = ({ text }) => {
        return <button className="btn">{text}</button>;
      };
    `.trim();

    const appComponentCode = `
      import React from 'react';
      import { Button } from './Button';

      function App() {
        return (
          <div className="container">
            <h1>My App</h1>
            <Button text="Click me" />
            <Button text="Submit" />
          </div>
        );
      }
      export default App;
    `.trim();

    const plugin = createVitePlugin();

    const buttonResult = await (plugin.transform as Function)(
      buttonComponentCode,
      'project/src/Button.jsx',
    );

    const appResult = await (plugin.transform as Function)(
      appComponentCode,
      'project/src/App.jsx',
    );

    expect(buttonResult).toBeDefined();
    expect(buttonResult.code).toContain('data-component-id="src/Button.jsx:3:');
    expect(buttonResult.code).toContain('data-component-name="button"');

    expect(appResult).toBeDefined();
    expect(appResult.code).toContain('data-component-id="src/App.jsx:6:');
    expect(appResult.code).toContain('data-component-id="src/App.jsx:7:');
    expect(appResult.code).toContain('data-component-id="src/App.jsx:8:');
    expect(appResult.code).toContain('data-component-id="src/App.jsx:9:');

    // Verify that each Button instance has unique component IDs
    const firstButtonMatch = appResult.code.match(
      /data-component-id="src\/App\.jsx:8:[0-9]+"/,
    );
    const secondButtonMatch = appResult.code.match(
      /data-component-id="src\/App\.jsx:9:[0-9]+"/,
    );

    expect(firstButtonMatch).toBeTruthy();
    expect(secondButtonMatch).toBeTruthy();
    expect(firstButtonMatch[0]).not.toEqual(secondButtonMatch[0]);
  });

  it('should skip Three.js elements from @react-three/fiber imports while tagging other elements', async () => {
    const threeJSCode = `
      import React from 'react';
      import { Canvas } from '@react-three/fiber';

      function App() {
        return (
          <div className="wrapper">
            <h1>Three.js Scene</h1>
            <Canvas>
              <div>Hello</div>
            </Canvas>
          </div>
        );
      }
      export default App;
    `;

    const plugin = createVitePlugin();
    const result = await (plugin.transform as Function)(
      threeJSCode,
      'project/src/App.jsx',
    );

    expect(result).toBeDefined();
    expect(result.code).toContain('data-component-name="div"'); // Regular div should be tagged
    expect(result.code).toContain('data-component-name="h1"'); // h1 should be tagged
    expect(result.code).not.toContain('data-component-name="Canvas"'); // Canvas should not be tagged (imported from Three.js)
  });

  it('should skip Three.js elements from @react-three/drei imports while tagging other elements', async () => {
    const threeJSCode = `
      import React from 'react';
      import { Box, OrbitControls } from '@react-three/drei';

      function App() {
        return (
          <div className="container">
            <h1>3D Scene</h1>
            <Box />
            <OrbitControls />
            <button>Reset Camera</button>
          </div>
        );
      }
      export default App;
    `;

    const plugin = createVitePlugin();
    const result = await (plugin.transform as Function)(
      threeJSCode,
      'project/src/App.jsx',
    );

    expect(result).toBeDefined();
    expect(result.code).toContain('data-component-name="div"'); // Regular div should be tagged
    expect(result.code).toContain('data-component-name="h1"'); // h1 should be tagged
    expect(result.code).toContain('data-component-name="button"'); // button should be tagged
    expect(result.code).not.toContain('data-component-name="Box"'); // Box should not be tagged (imported from Three.js)
    expect(result.code).not.toContain('data-component-name="OrbitControls"'); // OrbitControls should not be tagged (imported from Three.js)
  });

  it('should skip Three.js Fiber elements while tagging regular HTML elements', async () => {
    const threeJSCode = `
      import React from 'react';
      import * as THREE from 'three';
      import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

      function App() {
        return (
          <div className="scene-container">
            <h1>3D Scene</h1>
            <span>Scene loaded with GLTFLoader</span>
            <mesh>
              <boxGeometry />
              <meshStandardMaterial />
            </mesh>
          </div>
        );
      }
      export default App;
    `;

    const plugin = createVitePlugin();
    const result = await (plugin.transform as Function)(
      threeJSCode,
      'project/src/App.jsx',
    );

    expect(result).toBeDefined();
    expect(result.code).toContain('data-component-name="div"'); // Regular div should be tagged
    expect(result.code).toContain('data-component-name="h1"'); // h1 should be tagged
    expect(result.code).toContain('data-component-name="span"'); // span should be tagged
    expect(result.code).not.toContain('data-component-name="mesh"'); // mesh should not be tagged (Three.js Fiber element)
    expect(result.code).not.toContain('data-component-name="boxGeometry"'); // boxGeometry should not be tagged (Three.js Fiber element)
    expect(result.code).not.toContain(
      'data-component-name="meshStandardMaterial"',
    ); // meshStandardMaterial should not be tagged (Three.js Fiber element)
  });

  it('should skip Three.js elements from various @react-three packages while tagging other elements', async () => {
    const threeJSCode = `
      import React from 'react';
      import { useRapier } from '@react-three/rapier';
      import { Text } from '@react-three/a11y';

      function App() {
        return (
          <div className="physics-scene">
            <header>
              <h1>3D Scene with physics</h1>
            </header>
            <Text position={[0, 0, 0]}>Accessible 3D Text</Text>
            <p>This is a regular paragraph</p>
          </div>
        );
      }
      export default App;
    `;

    const plugin = createVitePlugin();
    const result = await (plugin.transform as Function)(
      threeJSCode,
      'project/src/App.jsx',
    );

    expect(result).toBeDefined();
    expect(result.code).toContain('data-component-name="div"'); // Regular div should be tagged
    expect(result.code).toContain('data-component-name="header"'); // header should be tagged
    expect(result.code).toContain('data-component-name="h1"'); // h1 should be tagged
    expect(result.code).toContain('data-component-name="p"'); // p should be tagged
    expect(result.code).not.toContain('data-component-name="Text"'); // Text should not be tagged (imported from Three.js)
  });
});
