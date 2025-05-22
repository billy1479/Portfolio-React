import React from 'react';
import qualificationsData from '../data/qualifications';

const QualificationsSection = () => {
  const { education, experience } = qualificationsData;

  return (
    <section id="qualifications" className="max-w-6xl w-full min-w-0 mb-16 bg-gray-800 rounded-xl shadow-md overflow-hidden">
      <div className="p-8">
        <h2 className="text-3xl font-bold mb-6 text-orange-500 border-b border-gray-700 pb-2">Qualifications</h2>
        
        {/* Education */}
        <div className="mb-8">
          <h3 className="text-xl font-bold mb-4 text-gray-200">Education</h3>
          <div className="space-y-6">
            {education.map((item, index) => (
              <div key={index} className="border-l-4 border-orange-600 pl-4">
                <div className="flex justify-between items-start">
                  <h4 className="text-lg font-semibold text-gray-200">{item.degree}</h4>
                  <span className="text-gray-400 text-sm">{item.period}</span>
                </div>
                <p className="text-orange-500">{item.institution}</p>
                <p className="text-gray-400 mt-2">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
        
        {/* Work Experience */}
        <div>
          <h3 className="text-xl font-bold mb-4 text-gray-200">Work Experience</h3>
          <div className="space-y-6">
            {experience.map((item, index) => (
              <div key={index} className="border-l-4 border-orange-600 pl-4">
                <div className="flex justify-between items-start">
                  <h4 className="text-lg font-semibold text-gray-200">{item.position}</h4>
                  <span className="text-gray-400 text-sm">{item.period}</span>
                </div>
                <p className="text-orange-500">{item.company}</p>
                <p className="text-gray-400 mt-2">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default QualificationsSection;