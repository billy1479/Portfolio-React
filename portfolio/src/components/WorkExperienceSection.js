// src/components/WorkExperienceSection.js
import React from 'react';
import workExperience from '../data/workExperience';

const WorkExperienceSection = () => (
  <section id="experience" className="max-w-6xl w-full min-w-0 mb-16 bg-gray-800 rounded-xl shadow-md overflow-hidden">
    <div className="p-8">
      <h2 className="text-3xl font-bold mb-6 text-orange-500 border-b border-gray-700 pb-2">Work Experience</h2>
      <div className="space-y-6">
        {workExperience.map((job, idx) => (
          <div key={idx} className="border-l-4 border-orange-600 pl-4">
            <div className="flex justify-between items-start">
              <h4 className="text-lg font-semibold text-gray-200">{job.position}</h4>
              <span className="text-gray-400 text-sm">{job.period}</span>
            </div>
            <p className="text-orange-500">{job.company}</p>
            <p className="text-gray-400 mt-2">{job.description}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default WorkExperienceSection;
