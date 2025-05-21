import React from 'react';
import skillsData from '../data/skills';

const LanguagesSection = () => {
  const { programmingLanguages, frontendTechnologies, backendTechnologies } = skillsData;
  
  // Component for skill bars
  const SkillBar = ({ name, level }) => (
    <div className="bg-gray-700 p-4 rounded-lg">
      <div className="flex justify-between mb-2">
        <h4 className="font-medium text-gray-200">{name}</h4>
        <span className="text-sm text-gray-400">{level}%</span>
      </div>
      <div className="w-full bg-gray-600 rounded-full h-2.5">
        <div 
          className="bg-orange-600 h-2.5 rounded-full" 
          style={{ width: `${level}%` }}
        ></div>
      </div>
    </div>
  );

  return (
    <section id="languages" className="max-w-4xl mx-auto mb-16 bg-gray-800 rounded-xl shadow-md overflow-hidden">
      <div className="p-8">
        <h2 className="text-3xl font-bold mb-6 text-orange-500 border-b border-gray-700 pb-2">Languages</h2>
        
        {/* Programming Languages */}
        <div className="mb-8">
          <h3 className="text-xl font-bold mb-4 text-gray-200">Programming Languages</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {programmingLanguages.map((skill, index) => (
              <SkillBar key={index} name={skill.name} level={skill.level} />
            ))}
          </div>
        </div>
        
        {/* Frontend Technologies */}
        <div className="mb-8">
          <h3 className="text-xl font-bold mb-4 text-gray-200">Frontend Technologies</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {frontendTechnologies.map((skill, index) => (
              <SkillBar key={index} name={skill.name} level={skill.level} />
            ))}
          </div>
        </div>
        
        {/* Backend & Other */}
        <div>
          <h3 className="text-xl font-bold mb-4 text-gray-200">Backend & Other</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {backendTechnologies.map((skill, index) => (
              <SkillBar key={index} name={skill.name} level={skill.level} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default LanguagesSection;