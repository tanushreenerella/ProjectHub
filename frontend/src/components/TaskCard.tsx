export default function TaskCard({task, updateTask}:any){

return(

<div className="task-card">

<strong>{task.title}</strong>

<div className="task-actions">

<button onClick={()=>updateTask(task.id,"todo")}>
Todo
</button>

<button onClick={()=>updateTask(task.id,"in_progress")}>
Progress
</button>

<button onClick={()=>updateTask(task.id,"done")}>
Done
</button>

</div>

</div>

)
}