import React, { useState } from 'react';
import { Task, TaskStatus, LabelStatus, SampleImage } from '../types';
import { X, Check, Trash2, Brain, AlertCircle } from 'lucide-react';

interface TaskDrawerProps {
  task: Task;
  onClose: () => void;
  onUpdateStatus: (taskId: string, status: TaskStatus) => void;
  onUpdateSampleCount: (taskId: string, count: number) => void;
}

// Mock samples generator
const generateMockSamples = (count: number): SampleImage[] => {
  return Array.from({ length: count }).map((_, i) => ({
    id: `sample_${i}`,
    url: `https://picsum.photos/300/200?random=${i}`,
    confidence: Math.random() * 0.5 + 0.4, // 0.4 - 0.9
    label: LabelStatus.UNLABELED,
    timestamp: new Date().toISOString()
  }));
};

export const TaskDrawer: React.FC<TaskDrawerProps> = ({ task, onClose, onUpdateStatus, onUpdateSampleCount }) => {
  const [samples, setSamples] = useState<SampleImage[]>(generateMockSamples(50));
  const [isTraining, setIsTraining] = useState(false);

  const stats = {
    unlabeled: samples.filter(s => s.label === LabelStatus.UNLABELED).length,
    positive: samples.filter(s => s.label === LabelStatus.POSITIVE).length,
    negative: samples.filter(s => s.label === LabelStatus.NEGATIVE).length,
  };

  const validSamples = stats.positive + stats.negative;
  const progress = Math.min(100, Math.round((validSamples / task.sample_count.threshold) * 100));

  const handleLabel = (id: string, label: LabelStatus) => {
    setSamples(prev => prev.map(s => s.id === id ? { ...s, label } : s));
  };

  const handleStartTraining = () => {
    if (window.confirm(`确认使用当前 ${validSamples} 个样本微调模型？预计耗时 5 分钟。`)) {
      setIsTraining(true);
      // Simulate API call
      setTimeout(() => {
        onUpdateStatus(task.id, TaskStatus.TRAINING);
        onUpdateSampleCount(task.id, validSamples);
        onClose();
      }, 1000);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/20 backdrop-blur-[1px]">
      <div className="w-[80vw] max-w-6xl bg-white h-full shadow-2xl flex flex-col animate-slide-in-right">
        {/* Header */}
        <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50">
          <div>
            <h2 className="text-xl font-bold text-gray-800">微调工作台</h2>
            <p className="text-sm text-gray-500">任务: {task.name} | 阈值: {task.sample_count.threshold}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full"><X size={24} className="text-gray-500"/></button>
        </div>

        {/* Dashboard */}
        <div className="px-8 py-6 border-b bg-white grid grid-cols-4 gap-8">
           <div className="text-center">
             <div className="text-3xl font-bold text-gray-800">{stats.unlabeled}</div>
             <div className="text-xs text-gray-500 uppercase tracking-wider">待审核</div>
           </div>
           <div className="text-center">
             <div className="text-3xl font-bold text-green-600">{stats.positive}</div>
             <div className="text-xs text-gray-500 uppercase tracking-wider">正样本 (OK)</div>
           </div>
           <div className="text-center">
             <div className="text-3xl font-bold text-red-600">{stats.negative}</div>
             <div className="text-xs text-gray-500 uppercase tracking-wider">负样本 (误报)</div>
           </div>
           <div className="flex flex-col justify-center">
             <div className="flex justify-between text-sm mb-1">
               <span className="font-medium text-gray-700">样本进度</span>
               <span className={progress >= 100 ? "text-green-600 font-bold" : "text-orange-600"}>{validSamples}/{task.sample_count.threshold}</span>
             </div>
             <div className="w-full bg-gray-200 rounded-full h-2.5">
               <div 
                  className={`h-2.5 rounded-full transition-all duration-500 ${progress >= 100 ? 'bg-green-500' : 'bg-yellow-400'}`} 
                  style={{ width: `${progress}%` }}
               ></div>
             </div>
           </div>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-6 bg-gray-100">
           <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {samples.map(sample => {
                 if (sample.label === LabelStatus.IGNORED) return null;
                 return (
                   <div key={sample.id} className={`group relative bg-white rounded-lg shadow-sm overflow-hidden transition-all border-2 ${
                      sample.label === LabelStatus.POSITIVE ? 'border-green-500' : 
                      sample.label === LabelStatus.NEGATIVE ? 'border-red-500 opacity-60' : 
                      'border-transparent hover:border-blue-300'
                   }`}>
                      <img src={sample.url} alt="sample" className="w-full h-40 object-cover" />
                      
                      {/* Confidence Tag */}
                      <div className="absolute top-2 left-2 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded backdrop-blur-md">
                        Conf: {(sample.confidence * 100).toFixed(0)}%
                      </div>

                      {/* Status Overlay */}
                      {sample.label === LabelStatus.POSITIVE && (
                        <div className="absolute top-2 right-2 bg-green-500 text-white rounded-full p-1"><Check size={12}/></div>
                      )}
                      {sample.label === LabelStatus.NEGATIVE && (
                        <div className="absolute inset-0 bg-gray-900/40 flex items-center justify-center pointer-events-none">
                           <span className="text-white font-bold text-lg border-2 border-white px-3 py-1 rounded transform -rotate-12">误报</span>
                        </div>
                      )}

                      {/* Hover Actions */}
                      <div className="absolute bottom-0 left-0 right-0 p-2 bg-white/95 border-t flex justify-around opacity-0 group-hover:opacity-100 transition-opacity">
                         <button 
                            onClick={() => handleLabel(sample.id, LabelStatus.POSITIVE)}
                            className="p-2 hover:bg-green-100 text-green-600 rounded" title="正确"
                          >
                           <Check size={18}/>
                         </button>
                         <button 
                            onClick={() => handleLabel(sample.id, LabelStatus.NEGATIVE)}
                            className="p-2 hover:bg-red-100 text-red-600 rounded" title="误报"
                          >
                           <X size={18}/>
                         </button>
                         <button 
                            onClick={() => handleLabel(sample.id, LabelStatus.IGNORED)}
                            className="p-2 hover:bg-gray-100 text-gray-400 rounded" title="忽略"
                          >
                           <Trash2 size={18}/>
                         </button>
                      </div>
                   </div>
                 );
              })}
           </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-white flex justify-end">
           <button 
             onClick={handleStartTraining}
             disabled={validSamples < 30 || isTraining}
             className="flex items-center px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg font-medium shadow-lg transition-colors"
           >
             {isTraining ? (
               <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
             ) : (
               <Brain className="mr-2" size={20}/>
             )}
             开始微调模型
           </button>
        </div>
      </div>
    </div>
  );
};
