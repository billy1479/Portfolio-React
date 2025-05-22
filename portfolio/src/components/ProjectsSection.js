import React, { useState } from 'react';
import { Github, ExternalLink } from 'lucide-react';
import projectsData from '../data/projects';

const ProjectsSection = () => {
  const [activeFilter, setActiveFilter] = useState('All');
  
  // Get unique categories from projects
  const categories = ['All', ...new Set(projectsData.map(project => project.category))];
  
  // Filter projects based on active category
  const filteredProjects = activeFilter === 'All' 
    ? projectsData 
    : projectsData.filter(project => project.category === activeFilter);

  return (
    <section id="projects" className="max-w-6xl w-full min-w-0 mb-16 bg-gray-800 rounded-xl shadow-md overflow-hidden">
      <div className="p-8">
        <h2 className="text-3xl font-bold mb-6 text-orange-500 border-b border-gray-700 pb-2">Projects</h2>
        
        {/* Project Filters */}
        <div className="flex flex-wrap gap-2 mb-8">
          {categories.map((filter) => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={`px-4 py-2 rounded-full text-sm transition-colors duration-200 ${
                filter === activeFilter 
                  ? 'bg-orange-600 text-white' 
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
              aria-label={`Filter projects by ${filter}`}
            >
              {filter}
            </button>
          ))}
        </div>
        
        {/* Projects Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredProjects.map((project, index) => (
            <div 
              key={index} 
              className="bg-gray-700 rounded-lg overflow-hidden shadow-md border border-gray-600 transition duration-300 hover:shadow-lg hover:border-orange-500"
            >
              <img 
                src={project.image} 
                alt={project.title} 
                className="w-full h-48 object-cover" 
              />
              <div className="p-6">
                <span className="inline-block px-3 py-1 text-xs font-semibold text-orange-200 bg-orange-900 rounded-full mb-2">
                  {project.category}
                </span>
                <h3 className="text-xl font-bold mb-2 text-gray-200">{project.title}</h3>
                <p className="text-gray-400 mb-4">{project.description}</p>
                <div className="flex flex-wrap gap-2 mb-4">
                  {project.tech.map((tech) => (
                    <span key={tech} className="bg-gray-800 text-gray-300 text-xs px-3 py-1 rounded-full">
                      {tech}
                    </span>
                  ))}
                </div>
                <div className="flex justify-between mt-4">
                  <div className="text-orange-500 font-medium flex items-center gap-1 hover:text-orange-400 cursor-pointer transition-colors duration-200">
                    Live Demo
                    <ExternalLink size={16} />
                  </div>
                  <div className="text-orange-500 font-medium flex items-center gap-1 hover:text-orange-400 cursor-pointer transition-colors duration-200">
                    Source Code
                    <Github size={16} />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ProjectsSection;