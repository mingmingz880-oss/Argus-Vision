import React, { useState, useEffect } from 'react';
import { Camera, Task, TaskStatus, AlarmLevel, EventLog, EventStatus, Algorithm } from './types';
import { TaskWizard } from './components/TaskWizard';
import { TaskDrawer } from './components/TaskDrawer';
import { EventCenter } from './components/EventCenter';
import {
   LayoutDashboard, ListVideo, AlertOctagon, Bell, Settings, Plus,
   Search, Sliders, PlayCircle, StopCircle, Trash2, HelpCircle
} from 'lucide-react';
import { format } from 'date-fns';

// --- MOCK DATA ---
const MOCK_CAMERAS: Camera[] = [
   { id: 'cam1', name: '1号大门入口', location: 'Gate 1', status: 'online', thumbnail: 'https://picsum.photos/id/1/800/450' },
   { id: 'cam2', name: '2号危险品仓库', location: 'Warehouse B', status: 'online', thumbnail: 'https://picsum.photos/id/10/800/450' },
   { id: 'cam3', name: '办公楼大厅', location: 'Lobby', status: 'offline', thumbnail: 'https://picsum.photos/id/20/800/450' },
   { id: 'cam4', name: '停车场西区', location: 'Parking West', status: 'online', thumbnail: 'https://picsum.photos/id/30/800/450' },
];

const MOCK_TASKS: Task[] = [
   {
      id: 'task_01',
      name: '仓库吸烟检测',
      camera_ids: ['cam2'],
      roi: [{ x: 0.1, y: 0.1 }, { x: 0.4, y: 0.1 }, { x: 0.4, y: 0.4 }, { x: 0.1, y: 0.4 }],
      algorithm: { id: 'smoking', name: '吸烟检测', description: '', version: 'v1.0', icon: '🚬', type: 'PRESET' },
      nlp_text: '检测是否有人在危险品区域吸烟',
      duration: 3,
      alarm_level: AlarmLevel.HIGH,
      status: TaskStatus.RUNNING,
      sample_count: { total: 45, labeled: 32, positive_threshold: 20, negative_threshold: 10 },
      created_at: '2023-10-25T10:00:00Z'
   },
   {
      id: 'task_02',
      name: '入口未戴安全帽',
      camera_ids: ['cam1'],
      roi: [],
      algorithm: { id: 'helmet', name: '安全帽检测', description: '', version: 'v1.4', icon: '⛑️', type: 'PRESET' },
      duration: 0,
      alarm_level: AlarmLevel.MEDIUM,
      status: TaskStatus.STOPPED,
      sample_count: { total: 12, labeled: 5, positive_threshold: 20, negative_threshold: 10 },
      created_at: '2023-10-26T14:30:00Z'
   }
];

const MOCK_EVENTS: EventLog[] = [
   {
      id: 'evt_1',
      task_id: 'task_01',
      trigger_time: '2023-10-27T09:15:32Z',
      alarm_level: AlarmLevel.HIGH,
      description: '吸烟检测 (持续 3.5s)',
      thumbnail: 'https://picsum.photos/id/101/400/225',
      video_url: '',
      biz_status: EventStatus.PENDING,
      roi: []
   },
   {
      id: 'evt_2',
      task_id: 'task_01',
      trigger_time: '2023-10-27T10:05:11Z',
      alarm_level: AlarmLevel.HIGH,
      description: '吸烟检测 (持续 4.1s)',
      thumbnail: 'https://picsum.photos/id/102/400/225',
      video_url: '',
      biz_status: EventStatus.PROCESSED,
      roi: []
   }
];

const App: React.FC = () => {
   const [currentView, setCurrentView] = useState<'TASKS' | 'EVENTS'>('TASKS');
   const [tasks, setTasks] = useState<Task[]>(MOCK_TASKS);
   const [events, setEvents] = useState<EventLog[]>(MOCK_EVENTS);

   // Modal States
   const [isWizardOpen, setIsWizardOpen] = useState(false);
   const [fineTuningTask, setFineTuningTask] = useState<Task | null>(null);

   const handleCreateTask = (newTaskPartial: Omit<Task, 'id' | 'created_at' | 'status'>) => {
      const newTask: Task = {
         ...newTaskPartial,
         id: `task_${Date.now()}`,
         created_at: new Date().toISOString(),
         status: TaskStatus.INIT,
      };

      // Simulate loading/init state transition
      setTasks([newTask, ...tasks]);
      setIsWizardOpen(false);

      setTimeout(() => {
         setTasks(prev => prev.map(t => t.id === newTask.id ? { ...t, status: TaskStatus.RUNNING } : t));
      }, 2000);
   };

   const updateTaskStatus = (id: string, status: TaskStatus) => {
      setTasks(prev => prev.map(t => t.id === id ? { ...t, status } : t));
   };

   const updateTaskSampleCount = (id: string, count: number) => {
      setTasks(prev => prev.map(t => t.id === id ? { ...t, sample_count: { ...t.sample_count, total: count } } : t));
   }

   const handleDeleteTask = (id: string) => {
      if (window.confirm('确认删除该任务吗？')) {
         setTasks(prev => prev.filter(t => t.id !== id));
      }
   };

   // --- Render Helpers ---
   const renderStatusBadge = (status: TaskStatus) => {
      const config = {
         [TaskStatus.INIT]: { color: 'bg-blue-100 text-blue-700', label: '初始化' },
         [TaskStatus.RUNNING]: { color: 'bg-green-100 text-green-700', label: '运行中' },
         [TaskStatus.STOPPED]: { color: 'bg-gray-100 text-gray-600', label: '已停止' },
         [TaskStatus.TRAINING]: { color: 'bg-purple-100 text-purple-700', label: '训练中' },
         [TaskStatus.ERROR]: { color: 'bg-red-100 text-red-700', label: '异常' },
      };
      const c = config[status];
      return (
         <span className={`px-2 py-1 rounded-full text-xs font-semibold ${c.color} flex items-center w-fit`}>
            <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${status === TaskStatus.RUNNING ? 'bg-green-500 animate-pulse' : 'bg-current'}`}></span>
            {c.label}
         </span>
      );
   };

   return (
      <div className="flex h-screen bg-gray-50 overflow-hidden">
         {/* Sidebar */}
         <aside className="w-64 bg-slate-900 text-white flex flex-col shadow-xl z-20">
            <div className="p-6 flex items-center space-x-3 border-b border-slate-800">
               <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                  <AlertOctagon size={20} className="text-white" />
               </div>
               <span className="text-lg font-bold tracking-tight">Argus Vision</span>
            </div>

            <nav className="flex-1 p-4 space-y-2">
               <button
                  onClick={() => setCurrentView('TASKS')}
                  className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${currentView === 'TASKS' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
               >
                  <ListVideo size={20} />
                  <span>任务管理</span>
               </button>

               <button
                  onClick={() => setCurrentView('EVENTS')}
                  className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${currentView === 'EVENTS' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
               >
                  <div className="relative">
                     <Bell size={20} />
                     {events.some(e => e.biz_status === EventStatus.PENDING) && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-slate-900"></span>}
                  </div>
                  <span>事件中心</span>
               </button>
            </nav>

            <div className="p-4 border-t border-slate-800">
               <div className="flex items-center space-x-3 px-4 py-3 text-slate-500 hover:text-white cursor-pointer transition-colors">
                  <Settings size={20} />
                  <span>系统设置</span>
               </div>
            </div>
         </aside>

         {/* Main Content */}
         <main className="flex-1 flex flex-col overflow-hidden relative">
            {/* Topbar */}
            <header className="h-16 bg-white border-b flex items-center justify-between px-8 shadow-sm z-10">
               <h1 className="text-xl font-bold text-gray-800">
                  {currentView === 'TASKS' ? '任务管理' : '事件中心'}
               </h1>
               <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2 text-sm text-gray-500 bg-gray-100 px-3 py-1.5 rounded-full">
                     <span className="w-2 h-2 rounded-full bg-green-500"></span>
                     <span>System Online</span>
                  </div>
                  <img src="https://i.pravatar.cc/150?img=11" alt="Admin" className="w-8 h-8 rounded-full border border-gray-200" />
               </div>
            </header>

            {/* Views */}
            <div className="flex-1 overflow-hidden p-8">
               {currentView === 'TASKS' ? (
                  <div className="flex flex-col h-full">
                     {/* Task Toolbar */}
                     <div className="flex justify-between mb-6">
                        <div className="relative w-64">
                           <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                           <input type="text" placeholder="搜索任务..." className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-100 outline-none" />
                        </div>
                        <button
                           onClick={() => setIsWizardOpen(true)}
                           className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center shadow-lg shadow-blue-600/20 transition-all active:scale-95"
                        >
                           <Plus size={18} className="mr-2" /> 新建任务
                        </button>
                     </div>

                     {/* Task Grid */}
                     <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                        <table className="w-full text-left">
                           <thead className="bg-gray-50 border-b">
                              <tr>
                                 <th className="px-6 py-4 font-semibold text-gray-600 text-sm">任务名称</th>
                                 <th className="px-6 py-4 font-semibold text-gray-600 text-sm">规则摘要</th>
                                 <th className="px-6 py-4 font-semibold text-gray-600 text-sm">约束条件</th>
                                 <th className="px-6 py-4 font-semibold text-gray-600 text-sm">样本进度</th>
                                 <th className="px-6 py-4 font-semibold text-gray-600 text-sm">状态</th>
                                 <th className="px-6 py-4 font-semibold text-gray-600 text-sm text-right">操作</th>
                              </tr>
                           </thead>
                           <tbody className="divide-y divide-gray-100">
                              {tasks.map(task => (
                                 <tr key={task.id} className="hover:bg-gray-50 transition-colors group">
                                    <td className="px-6 py-4">
                                       <div className="font-medium text-gray-900">{task.name}</div>
                                       <div className="text-xs text-gray-400">{task.id}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                       <div className="flex items-center text-sm text-gray-600" title={task.nlp_text || task.algorithm.description}>
                                          <span className="mr-2 text-lg">{task.algorithm.icon}</span>
                                          {task.nlp_text ? (task.nlp_text.length > 15 ? task.nlp_text.substring(0, 15) + '...' : task.nlp_text) : task.algorithm.name}
                                       </div>
                                    </td>
                                    <td className="px-6 py-4">
                                       <div className="flex space-x-2">
                                          {task.roi.length > 0 && (
                                             <span className="p-1 bg-blue-50 text-blue-600 rounded text-xs border border-blue-100" title="已设区域">ROI</span>
                                          )}
                                          {task.duration > 0 ? (
                                             <span className="p-1 bg-orange-50 text-orange-600 rounded text-xs border border-orange-100"> &gt; {task.duration}s</span>
                                          ) : (
                                             <span className="p-1 bg-gray-100 text-gray-500 rounded text-xs">即时</span>
                                          )}
                                       </div>
                                    </td>
                                    <td className="px-6 py-4">
                                       <div className="text-sm">
                                          <div className="flex items-center mb-1">
                                             <span className="text-gray-500 text-xs w-16">样本总数:</span>
                                             <span className="font-semibold text-gray-800">{task.sample_count.total}</span>
                                          </div>
                                          <div className="flex items-center mb-1">
                                             <span className="text-gray-500 text-xs w-16">已标记:</span>
                                             <span className="font-medium text-blue-600">{task.sample_count.labeled}</span>
                                          </div>
                                          <div className="flex items-center text-xs text-gray-400">
                                             <span className="text-green-600">正+{task.sample_count.positive_threshold}</span>
                                             <span className="mx-1">/</span>
                                             <span className="text-red-500">负+{task.sample_count.negative_threshold}</span>
                                          </div>
                                       </div>
                                    </td>
                                    <td className="px-6 py-4">
                                       {renderStatusBadge(task.status)}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                       <div className="flex justify-end items-center space-x-2">
                                          <button
                                             onClick={() => setFineTuningTask(task)}
                                             disabled={task.status === TaskStatus.TRAINING}
                                             className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded disabled:text-gray-300 disabled:hover:bg-transparent"
                                             title="微调模型"
                                          >
                                             <Sliders size={18} />
                                          </button>
                                          {task.status === TaskStatus.RUNNING ? (
                                             <button
                                                onClick={() => updateTaskStatus(task.id, TaskStatus.STOPPED)}
                                                className="p-1.5 text-red-600 hover:bg-red-50 rounded" title="停止"
                                             >
                                                <StopCircle size={18} />
                                             </button>
                                          ) : (
                                             <button
                                                onClick={() => updateTaskStatus(task.id, TaskStatus.RUNNING)}
                                                className="p-1.5 text-green-600 hover:bg-green-50 rounded" title="启动"
                                             >
                                                <PlayCircle size={18} />
                                             </button>
                                          )}
                                          <button
                                             onClick={() => handleDeleteTask(task.id)}
                                             className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded" title="删除"
                                          >
                                             <Trash2 size={18} />
                                          </button>
                                       </div>
                                    </td>
                                 </tr>
                              ))}
                           </tbody>
                        </table>
                     </div>
                  </div>
               ) : (
                  <div className="bg-white rounded-xl shadow-sm border h-full overflow-hidden">
                     <EventCenter events={events} />
                  </div>
               )}
            </div>
         </main>

         {/* OVERLAYS */}
         {isWizardOpen && (
            <TaskWizard
               cameras={MOCK_CAMERAS}
               onClose={() => setIsWizardOpen(false)}
               onSave={handleCreateTask}
            />
         )}

         {fineTuningTask && (
            <TaskDrawer
               task={fineTuningTask}
               onClose={() => setFineTuningTask(null)}
               onUpdateStatus={updateTaskStatus}
               onUpdateSampleCount={updateTaskSampleCount}
            />
         )}
      </div>
   );
};

export default App;