import React, { useState, useMemo } from 'react';
import { useAppContext } from '../store/AppContext';
import { Initiative, Task } from '../types';
import { addDays, differenceInDays, format, parseISO, startOfDay, startOfWeek, endOfWeek } from 'date-fns';
import { cn } from '../lib/utils';
import { Check, Plus, Archive as ArchiveIcon, MessageSquare, User, Calendar, ZoomIn, ZoomOut, ChevronLeft, ChevronRight } from 'lucide-react';
import { TaskModal } from './TaskModal';
import { TaskDetailModal } from './TaskDetailModal';
import { InitiativeDetailModal } from './InitiativeDetailModal';

interface GanttChartProps {
  initiatives: Initiative[];
  /** When true (default), clicking an initiative name in the sidebar opens InitiativeDetailModal.
   *  Set to false in Dashboard's detail view where edit/complete buttons are already at the top. */
  showInitiativeDetail?: boolean;
  /** 'incomplete' = show only incomplete tasks, 'all' = show all tasks (completed at bottom). Default: 'all' */
  taskFilter?: 'incomplete' | 'all';
}

export const GanttChart = ({ initiatives, showInitiativeDetail = true, taskFilter = 'all' }: GanttChartProps) => {
  const { tasks, memos, categories, users, currentUser, toggleTaskCompletion, archiveInitiative, updateTask } = useAppContext();
  const [zoomLevel, setZoomLevel] = useState(75); // Default 75%
  const [viewMode, setViewMode] = useState<'daily' | 'weekly'>('daily');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [activeInitiativeId, setActiveInitiativeId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [archiveConfirmId, setArchiveConfirmId] = useState<string | null>(null);
  const [detailInitiativeId, setDetailInitiativeId] = useState<string | null>(null);

  const baseCellWidth = viewMode === 'daily' ? 40 : 140;
  const cellWidth = baseCellWidth * (zoomLevel / 100);
  const pixelsPerDay = viewMode === 'daily' ? cellWidth : cellWidth / 7;

  // Calculate timeline range (e.g., today - 4 days to today + 45 days)
  const timelineStartDate = useMemo(() => addDays(startOfDay(new Date()), -4), []);
  const timelineEndDate = useMemo(() => addDays(startOfDay(new Date()), 45), []);
  
  const gridStartDate = viewMode === 'daily' ? timelineStartDate : startOfWeek(timelineStartDate, { weekStartsOn: 0 });

  const days = useMemo(() => {
    const d = [];
    let current = timelineStartDate;
    while (current <= timelineEndDate) {
      d.push(current);
      current = addDays(current, 1);
    }
    return d;
  }, [timelineStartDate, timelineEndDate]);

  const weeks = useMemo(() => {
    const w = [];
    let current = startOfWeek(timelineStartDate, { weekStartsOn: 0 });
    const end = endOfWeek(timelineEndDate, { weekStartsOn: 0 });
    while (current <= end) {
      w.push(current);
      current = addDays(current, 7);
    }
    return w;
  }, [timelineStartDate, timelineEndDate]);

  const getTasksForInitiative = (initId: string) => {
    const all = tasks.filter(t => t.initiativeId === initId);
    const incomplete = all
      .filter(t => !t.isCompleted)
      .sort((a, b) => new Date(a.endDate).getTime() - new Date(b.endDate).getTime());
    if (taskFilter === 'incomplete') return incomplete;
    const completed = all
      .filter(t => t.isCompleted)
      .sort((a, b) => new Date(a.endDate).getTime() - new Date(b.endDate).getTime());
    return [...incomplete, ...completed];
  };

  const getCategoryName = (catId: string) => categories.find(c => c.id === catId)?.name || '不明';
  const getUserName = (userId?: string) => users.find(u => u.id === userId)?.name;

  return (
    <div className="flex-1 overflow-auto relative bg-white">
      <div className="inline-flex flex-col min-w-full">
        {/* Header Row */}
        <div className="flex border-b border-gray-200 bg-gray-50 sticky top-0 z-30">
          <div className={cn(
            "flex-shrink-0 sticky left-0 bg-gray-50 border-r border-gray-200 p-2 sm:p-3 font-semibold text-xs sm:text-sm text-gray-700 z-40 shadow-[1px_0_0_0_#e6ded4] flex items-center justify-between transition-all duration-300",
            isSidebarCollapsed ? "w-10 sm:w-12 px-1 sm:px-2" : "w-48 sm:w-80"
          )}>
            {!isSidebarCollapsed && <span className="truncate">施策 / タスク</span>}
            <button 
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="p-1 hover:bg-gray-200 rounded text-gray-500 flex-shrink-0 mx-auto"
              title={isSidebarCollapsed ? "リストを展開" : "リストを折りたたむ"}
            >
              {isSidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          </div>
          <div className="flex">
            {viewMode === 'daily' ? days.map(day => {
              const isToday = differenceInDays(day, startOfDay(new Date())) === 0;
              const dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][day.getDay()];
              const isWeekend = day.getDay() === 0 || day.getDay() === 6;
              return (
                <div 
                  key={day.toISOString()} 
                  className={cn(
                    "flex-shrink-0 border-r border-gray-200 flex flex-col items-center justify-center text-[10px] sm:text-xs",
                    isToday ? "bg-blue-50 text-blue-700 font-bold" : "text-gray-600",
                    isWeekend && !isToday ? "bg-gray-50/50" : ""
                  )}
                  style={{ width: cellWidth }}
                >
                  <div className="whitespace-nowrap overflow-hidden text-ellipsis w-full text-center">
                    {cellWidth >= 30 ? format(day, 'M/d') : format(day, 'd')}
                  </div>
                  {cellWidth >= 30 && (
                    <div className={cn(
                      "text-[8px] sm:text-[10px] mt-0.5",
                      day.getDay() === 0 ? "text-red-500" : day.getDay() === 6 ? "text-blue-500" : "text-gray-400"
                    )}>
                      ({dayOfWeek})
                    </div>
                  )}
                </div>
              );
            }) : weeks.map(week => {
              const weekEnd = addDays(week, 6);
              const isCurrentWeek = new Date() >= week && new Date() <= weekEnd;
              return (
                <div 
                  key={week.toISOString()} 
                  className={cn(
                    "flex-shrink-0 border-r border-gray-200 flex flex-col items-center justify-center text-[10px] sm:text-xs",
                    isCurrentWeek ? "bg-blue-50 text-blue-700 font-bold" : "text-gray-600"
                  )}
                  style={{ width: cellWidth }}
                >
                  <div className="whitespace-nowrap overflow-hidden text-ellipsis w-full text-center">
                    {format(week, 'M/d')} ~ {format(weekEnd, 'M/d')}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Body */}
        {initiatives.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm sticky left-0">
            表示できる施策がありません。
          </div>
        ) : (
          initiatives.map(init => {
            const initTasks = getTasksForInitiative(init.id);
            const initAssigneeNames = init.assigneeIds && init.assigneeIds.length > 0
              ? init.assigneeIds.map(id => getUserName(id)).filter(Boolean).join(', ')
              : init.assigneeId ? getUserName(init.assigneeId) : null;
            return (
              <div key={init.id} className="flex flex-col">
                {/* Initiative Row */}
                <div className="flex border-b border-gray-200 bg-gray-100 hover:bg-gray-200 transition-colors group">
                  <div className={cn(
                    "flex-shrink-0 sticky left-0 bg-gray-100 group-hover:bg-gray-200 border-r border-gray-200 p-2 sm:pl-3 flex items-center justify-between z-20 shadow-[1px_0_0_0_#e6ded4] transition-all duration-300",
                    isSidebarCollapsed ? "w-10 sm:w-12 px-1 sm:px-2" : "w-48 sm:w-80"
                  )}>
                    <button
                      onClick={() => showInitiativeDetail && setDetailInitiativeId(init.id)}
                      className={cn("flex flex-col overflow-hidden pr-2 text-left w-full", showInitiativeDetail ? "hover:opacity-70 transition-opacity cursor-pointer" : "cursor-default")}
                    >
                      {!isSidebarCollapsed ? (
                        <>
                          <span className="font-medium text-xs sm:text-sm text-gray-900 truncate w-full" title={init.title}>{init.title}</span>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] sm:text-xs text-gray-500 truncate hidden sm:block">{getCategoryName(init.categoryId)}</span>
                            {initAssigneeNames && (
                              <span className="text-[10px] sm:text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full flex items-center gap-0.5 truncate max-w-[120px]" title={initAssigneeNames}>
                                <User className="w-3 h-3 flex-shrink-0" />
                                <span className="truncate">{initAssigneeNames}</span>
                              </span>
                            )}
                          </div>
                        </>
                      ) : (
                        <div className="w-full flex justify-center">
                          <div className="w-2 h-2 rounded-full bg-blue-500" title={init.title}></div>
                        </div>
                      )}
                    </button>
                    {!isSidebarCollapsed && (
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveInitiativeId(init.id);
                          }}
                          className="p-1 sm:p-1.5 text-blue-600 hover:bg-blue-100 rounded"
                          title="タスク追加"
                        >
                          <Plus className="w-3 h-3 sm:w-4 sm:h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="flex relative">
                    {viewMode === 'daily' ? days.map(day => (
                      <div key={day.toISOString()} className="flex-shrink-0 border-r border-gray-200/50" style={{ width: cellWidth }}></div>
                    )) : weeks.map(week => (
                      <div key={week.toISOString()} className="flex-shrink-0 border-r border-gray-200/50" style={{ width: cellWidth }}></div>
                    ))}
                  </div>
                </div>

                {/* Task Rows */}
                {initTasks.map(task => {
                  const taskMemosCount = memos.filter(m => m.taskId === task.id).length;
                  const hasUnreadMemos = memos.some(m => 
                    m.taskId === task.id && 
                    m.userId !== currentUser?.id && 
                    (!task.readStatus?.[currentUser?.id || ''] || new Date(m.createdAt) > new Date(task.readStatus[currentUser?.id || '']))
                  );
                  const taskAssigneeNames = task.assigneeIds && task.assigneeIds.length > 0 
                    ? task.assigneeIds.map(id => getUserName(id)).filter(Boolean).join(', ')
                    : task.assigneeId ? getUserName(task.assigneeId) : null;
                  return (
                  <div key={task.id} className="flex border-b border-gray-100 bg-white hover:bg-gray-50 transition-colors group">
                    <div className={cn(
                      "flex-shrink-0 sticky left-0 bg-white group-hover:bg-gray-50 border-r border-gray-200 p-2 flex items-center gap-2 sm:gap-3 z-20 shadow-[1px_0_0_0_#e6ded4] transition-all duration-300",
                      isSidebarCollapsed ? "w-10 sm:w-12 px-1 sm:px-2 justify-center" : "w-48 sm:w-80 pl-2 sm:pl-8"
                    )}>
                      <button
                        onClick={() => toggleTaskCompletion(task.id)}
                        className={cn(
                          "w-3 h-3 sm:w-4 sm:h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors",
                          task.isCompleted ? "bg-blue-500 border-blue-500 text-white" : "border-gray-300 text-transparent hover:border-blue-400"
                        )}
                        title={isSidebarCollapsed ? task.title : undefined}
                      >
                        <Check className="w-2 h-2 sm:w-3 sm:h-3" />
                      </button>
                      {!isSidebarCollapsed && (
                        <button 
                          onClick={() => setSelectedTaskId(task.id)}
                          className="flex flex-col flex-1 min-w-0 text-left hover:opacity-80 transition-opacity relative"
                        >
                          <div className="flex items-center gap-1 sm:gap-2 w-full">
                            <span className={cn(
                              "text-xs sm:text-sm truncate",
                              task.isCompleted ? "line-through text-gray-400" : "text-gray-700"
                            )} title={task.title}>
                              {task.title}
                            </span>
                            {hasUnreadMemos && (
                              <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-red-500 flex-shrink-0" title="未読コメントあり" />
                            )}
                            {(task.description || taskMemosCount > 0) && !hasUnreadMemos && (
                              <MessageSquare className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-gray-400 flex-shrink-0" />
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 w-full overflow-hidden">
                            {taskAssigneeNames && (
                              <span className="text-[10px] text-gray-500 flex items-center gap-0.5 truncate" title={taskAssigneeNames}>
                                <User className="w-2.5 h-2.5 flex-shrink-0" />
                                <span className="truncate">{taskAssigneeNames}</span>
                              </span>
                            )}
                            <span className={cn(
                              "text-[10px] flex items-center gap-0.5 shrink-0",
                              new Date(task.endDate) < new Date() && !task.isCompleted ? "text-red-500 font-medium" : "text-gray-500"
                            )}>
                              <Calendar className="w-2.5 h-2.5 flex-shrink-0" />
                              <span>{task.endDate.replace(/-/g, '/')}</span>
                            </span>
                          </div>
                        </button>
                      )}
                    </div>
                    <div className="flex relative">
                      {viewMode === 'daily' ? days.map(day => {
                        const isToday = differenceInDays(day, startOfDay(new Date())) === 0;
                        return (
                          <div 
                            key={day.toISOString()} 
                            className={cn(
                              "flex-shrink-0 border-r border-gray-100",
                              isToday && "bg-blue-50/30"
                            )} 
                            style={{ width: cellWidth }}
                          ></div>
                        );
                      }) : weeks.map(week => {
                        const weekEnd = addDays(week, 6);
                        const isCurrentWeek = new Date() >= week && new Date() <= weekEnd;
                        return (
                          <div 
                            key={week.toISOString()} 
                            className={cn(
                              "flex-shrink-0 border-r border-gray-100",
                              isCurrentWeek && "bg-blue-50/30"
                            )} 
                            style={{ width: cellWidth }}
                          ></div>
                        );
                      })}
                      {/* Task Bar */}
                      <TaskBar 
                        task={task} 
                        timelineStartDate={gridStartDate} 
                        pixelsPerDay={pixelsPerDay}
                        onClick={() => setSelectedTaskId(task.id)} 
                        onUpdate={(taskId, newStartDate, newEndDate) => {
                          updateTask(taskId, task.title, newStartDate, newEndDate, task.assigneeIds);
                        }}
                      />
                    </div>
                  </div>
                )})}
              </div>
            );
          })
        )}
      </div>

      {activeInitiativeId && (
        <TaskModal initiativeId={activeInitiativeId} onClose={() => setActiveInitiativeId(null)} />
      )}
      
      {selectedTaskId && (
        <TaskDetailModal taskId={selectedTaskId} onClose={() => setSelectedTaskId(null)} />
      )}

      {detailInitiativeId && (
        <InitiativeDetailModal initiativeId={detailInitiativeId} onClose={() => setDetailInitiativeId(null)} />
      )}

      {archiveConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">施策の完了</h3>
            <p className="text-sm text-gray-600 mb-6">
              この施策を完了（アーカイブ）にしますか？<br />
              完了した施策はアーカイブ画面に移動します。
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setArchiveConfirmId(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
              >
                キャンセル
              </button>
              <button
                onClick={() => {
                  archiveInitiative(archiveConfirmId);
                  setArchiveConfirmId(null);
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md"
              >
                完了にする
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Zoom Controls */}
      <div className="fixed sm:absolute bottom-4 right-4 z-40 flex items-center gap-2 bg-white border border-gray-200 shadow-lg rounded-lg p-1">
        <div className="flex items-center bg-gray-100 rounded p-0.5">
          <button 
            onClick={() => setViewMode('daily')}
            className={cn("px-2 py-1 text-xs font-medium rounded transition-colors", viewMode === 'daily' ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700")}
          >
            日
          </button>
          <button 
            onClick={() => setViewMode('weekly')}
            className={cn("px-2 py-1 text-xs font-medium rounded transition-colors", viewMode === 'weekly' ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700")}
          >
            週
          </button>
        </div>
        <div className="w-px h-4 bg-gray-300 mx-1"></div>
        <div className="flex items-center gap-1">
          <button onClick={() => setZoomLevel(z => Math.max(25, z - 25))} className="p-1.5 hover:bg-gray-100 rounded text-gray-600" title="縮小">
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-xs font-medium text-gray-500 w-12 text-center">{zoomLevel}%</span>
          <button onClick={() => setZoomLevel(z => Math.min(200, z + 25))} className="p-1.5 hover:bg-gray-100 rounded text-gray-600" title="拡大">
            <ZoomIn className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

const TaskBar = ({ task, timelineStartDate, pixelsPerDay, onClick, onUpdate }: { task: Task, timelineStartDate: Date, pixelsPerDay: number, onClick: () => void, onUpdate: (taskId: string, newStartDate: string, newEndDate: string) => void }) => {
  const startOffsetDays = differenceInDays(parseISO(task.startDate), timelineStartDate);
  const durationDays = differenceInDays(parseISO(task.endDate), parseISO(task.startDate)) + 1;

  const initialLeft = startOffsetDays * pixelsPerDay;
  const initialWidth = durationDays * pixelsPerDay;

  const [dragState, setDragState] = useState<{
    type: 'move' | 'resize-left' | 'resize-right' | null;
    startX: number;
    currentLeft: number;
    currentWidth: number;
    hasMoved: boolean;
  }>({ type: null, startX: 0, currentLeft: initialLeft, currentWidth: initialWidth, hasMoved: false });

  const dragStateRef = React.useRef(dragState);
  React.useEffect(() => {
    dragStateRef.current = dragState;
  }, [dragState]);

  // Reset visual state when task changes
  React.useEffect(() => {
    setDragState(prev => ({ ...prev, currentLeft: initialLeft, currentWidth: initialWidth, hasMoved: false }));
  }, [initialLeft, initialWidth]);

  const handleMouseDown = (e: React.MouseEvent, type: 'move' | 'resize-left' | 'resize-right') => {
    e.stopPropagation();
    setDragState({
      type,
      startX: e.clientX,
      currentLeft: initialLeft,
      currentWidth: initialWidth,
      hasMoved: false
    });
  };

  React.useEffect(() => {
    if (!dragState.type) return;

    const handleMouseMove = (e: MouseEvent) => {
      const state = dragStateRef.current;
      const deltaX = e.clientX - state.startX;
      if (Math.abs(deltaX) > 5 && !state.hasMoved) {
        setDragState(prev => ({ ...prev, hasMoved: true }));
      }
      const deltaDays = Math.round(deltaX / pixelsPerDay);
      const deltaPx = deltaDays * pixelsPerDay; // Snap to grid

      if (state.type === 'move') {
        setDragState(prev => ({
          ...prev,
          currentLeft: initialLeft + deltaPx
        }));
      } else if (state.type === 'resize-left') {
        const newLeft = initialLeft + deltaPx;
        const newWidth = initialWidth - deltaPx;
        if (newWidth >= pixelsPerDay) {
          setDragState(prev => ({
            ...prev,
            currentLeft: newLeft,
            currentWidth: newWidth
          }));
        }
      } else if (state.type === 'resize-right') {
        const newWidth = initialWidth + deltaPx;
        if (newWidth >= pixelsPerDay) {
          setDragState(prev => ({
            ...prev,
            currentWidth: newWidth
          }));
        }
      }
    };

    const handleMouseUp = () => {
      const state = dragStateRef.current;
      if (state.type && state.hasMoved) {
        // Calculate new dates
        const newStartOffsetDays = Math.round(state.currentLeft / pixelsPerDay);
        const newDurationDays = Math.round(state.currentWidth / pixelsPerDay);
        
        const newStartDate = format(addDays(timelineStartDate, newStartOffsetDays), 'yyyy-MM-dd');
        const newEndDate = format(addDays(timelineStartDate, newStartOffsetDays + newDurationDays - 1), 'yyyy-MM-dd');

        if (newStartDate !== task.startDate || newEndDate !== task.endDate) {
          onUpdate(task.id, newStartDate, newEndDate);
        }
      }
      
      // Delay resetting the state slightly so onClick can check hasMoved
      setTimeout(() => {
        setDragState(prev => ({ ...prev, type: null, hasMoved: false }));
      }, 0);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState.type, initialLeft, initialWidth, timelineStartDate, task.id, onUpdate, task.startDate, task.endDate]);

  let displayLeft = dragState.type ? dragState.currentLeft : initialLeft;
  let displayWidth = dragState.type ? dragState.currentWidth : initialWidth;

  // Handle tasks that start before the timeline visually
  if (displayLeft < 0) {
    displayWidth += displayLeft;
    displayLeft = 0;
  }

  if (displayWidth <= 0) return null;

  return (
    <div
      className={cn(
        "absolute top-1.5 bottom-1.5 rounded-md shadow-sm flex items-center z-10 transition-colors group overflow-hidden",
        task.isCompleted ? "bg-gray-200 text-gray-500" : "bg-blue-500 text-white",
        dragState.type ? "opacity-80 z-50 cursor-grabbing" : "cursor-pointer hover:brightness-110"
      )}
      style={{ left: `${displayLeft}px`, width: `${displayWidth}px` }}
      title={`${task.title} (${task.startDate} ~ ${task.endDate})`}
      onMouseDown={(e) => handleMouseDown(e, 'move')}
      onClick={(e) => {
        if (!dragState.hasMoved) onClick();
      }}
    >
      {/* Left Resize Handle */}
      <div 
        className="absolute left-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-black/20"
        onMouseDown={(e) => handleMouseDown(e, 'resize-left')}
        onClick={(e) => e.stopPropagation()}
      />
      
      <span className="flex-1 min-w-0 px-2 overflow-hidden text-[10px] leading-tight break-words pointer-events-none select-none line-clamp-3">
        {task.title}
      </span>

      {/* Right Resize Handle */}
      <div 
        className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-black/20"
        onMouseDown={(e) => handleMouseDown(e, 'resize-right')}
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
};
