// Mock all static asset imports (images, etc.)
jest.mock('./assets/profilepicture.jpeg', () => '');
jest.mock('./assets/Projects/jobsheet-system-power-app/powerapps.png', () => '');
jest.mock('./assets/Projects/calendar/powerapps.png', () => '');
jest.mock('./assets/Projects/purchase-ledger/powerapps.png', () => '');
jest.mock('./assets/Projects/jobsheet-system-php-and-node-js-web-app/nodejs.png', () => '');
jest.mock('./assets/Projects/inventory-system/nodejs.png', () => '');
jest.mock('./assets/Projects/machine-learning-coursework/python.png', () => '');
jest.mock('./assets/Projects/networking-coursework/python.png', () => '');
jest.mock('./assets/Projects/programming-paradigms-coursework/cpp.png', () => '');
jest.mock('./assets/Projects/image-processing/python.png', () => '');
jest.mock('./assets/Projects/travelling-salesman-problem-ai-search/python.png', () => '');
jest.mock('./assets/Projects/reinforcement-learning/python.png', () => '');
jest.mock('./assets/Projects/virtual-reality-coursework/python.png', () => '');
jest.mock('./assets/Projects/multimedia-game-development/csharp.png', () => '');
jest.mock('./assets/Projects/recommender-systems/python.png', () => '');
jest.mock('./assets/Projects/cryptography/python.png', () => '');
jest.mock('./assets/Projects/deep-learning/python.png', () => '');
jest.mock('./assets/Projects/ibm-skills-build-ar-application/csharp.png', () => '');
jest.mock('./assets/Projects/movein-student-house-finding-app/flutter.png', () => '');
jest.mock('./assets/Projects/william-stapleton/nodejs.png', () => '');
jest.mock('./assets/Projects/lbl-digital/nodejs.png', () => '');
jest.mock('./assets/Projects/toot-hill-school-student-union-website/php.png', () => '');

// Mock all main components to isolate App rendering
jest.mock('./components/Sidebar', () => () => <div>Sidebar</div>);
jest.mock('./components/AboutSection', () => () => <div>AboutSection</div>);
jest.mock('./components/QualificationSection', () => () => <div>QualificationSection</div>);
jest.mock('./components/LanguagesSection', () => () => <div>LanguagesSection</div>);
jest.mock('./components/ProjectsSection', () => () => <div>ProjectsSection</div>);
jest.mock('./components/WorkExperienceSection', () => () => <div>WorkExperienceSection</div>);
jest.mock('./components/Footer', () => () => <div>Footer</div>);

import { render } from '@testing-library/react';
import App from './App';

test('renders App without crashing', () => {
  render(<App />);
});
