import React from 'react';
import skillsData from '../data/skills';

const LanguagesSection = () => {
  const { programmingLanguages, frontendTechnologies, backendTechnologies, microsoftPowerPlatform } = skillsData;

  // Helper to get icon path by skill name
  const getIconPath = (name) =>
    require(`../assets/Coding/${name.replace(/[#/.+ ]/g, '').toLowerCase()}.png`);

  return (
    <section id="languages" className="max-w-6xl w-full min-w-0 mb-16 bg-gray-800 rounded-xl shadow-md overflow-hidden">
      <div className="p-8">
        <h2 className="text-3xl font-bold mb-6 text-orange-500 border-b border-gray-700 pb-2">Languages</h2>
        
        {/* Programming Languages */}
        <div className="mb-8">
          <h3 className="text-xl font-bold mb-4 text-gray-200">Programming Languages</h3>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {programmingLanguages.map((skill, index) => (
              <li key={index} className="bg-gray-700 p-4 rounded-lg font-medium text-gray-200 flex items-center gap-3">
                <img
                  src={getIconPath(skill.image)}
                  alt={`${skill.name} icon`}
                  style={{ width: '100px', height: '100px', objectFit: 'contain' }}
                  className="flex-shrink-0"
                />
                <span>{skill.name}</span>
              </li>
            ))}
          </ul>
        </div>
        
        {/* Frontend Technologies */}
        <div className="mb-8">
          <h3 className="text-xl font-bold mb-4 text-gray-200">Frontend Technologies</h3>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {frontendTechnologies.map((skill, index) => (
              <li key={index} className="bg-gray-700 p-4 rounded-lg font-medium text-gray-200 flex items-center gap-3">
                <img
                  src={getIconPath(skill.image)}
                  alt={`${skill.name} icon`}
                  style={{ width: '100px', height: '100px', objectFit: 'contain' }}
                  className="flex-shrink-0"
                />
                <span>{skill.name}</span>
              </li>
            ))}
          </ul>
        </div>
        
        {/* Backend */}
        <div className="mb-8">
          <h3 className="text-xl font-bold mb-4 text-gray-200">Backend & Other</h3>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {backendTechnologies.map((skill, index) => (
              <li key={index} className="bg-gray-700 p-4 rounded-lg font-medium text-gray-200 flex items-center gap-3">
                <img
                  src={getIconPath(skill.image)}
                  alt={`${skill.name} icon`}
                  style={{ width: '100px', height: '100px', objectFit: 'contain' }}
                  className="flex-shrink-0"
                />
                <span>{skill.name}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Power Platform */}
        <div>
          <h3 className="text-xl font-bold mb-4 text-gray-200">Microsoft Power Platform</h3>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {microsoftPowerPlatform.map((skill, index) => (
              <li key={index} className="bg-gray-700 p-4 rounded-lg font-medium text-gray-200 flex items-center gap-3">
                <img
                  src={getIconPath(skill.image)}
                  alt={`${skill.name} icon`}
                  style={{ width: '100px', height: '100px', objectFit: 'contain' }}
                  className="flex-shrink-0"
                />
                <span>{skill.name}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
};

export default LanguagesSection;