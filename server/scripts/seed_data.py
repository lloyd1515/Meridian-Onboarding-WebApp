import asyncio
import datetime
from sqlalchemy import select, delete
from app.core.database import engine, Base, AsyncSessionLocal
from app.models import Employee, ChecklistTask, ScheduleEntry
from app.core.security import hash_password

async def seed():
    print("Connecting to database and recreating tables if necessary...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as session:
        # Clear existing data to allow clean re-runs of seed script
        print("Clearing existing tables...")
        await session.execute(delete(ScheduleEntry))
        await session.execute(delete(ChecklistTask))
        await session.execute(delete(Employee))
        await session.commit()

        print("Seeding core employees...")
        default_pwd = hash_password("password123")

        # 1. Vlad HR Admin
        admin = Employee(
            name="Vlad HR Admin",
            email="vlad.hr@meridian.com",
            slack_handle="@vlad.hr",
            role="hr_admin",
            department="HR",
            hire_date=datetime.date(2022, 1, 15),
            hashed_password=default_pwd,
            hybrid_preference="HIBRID"
        )
        session.add(admin)

        # 2. Alex Johnson (Buddy)
        buddy = Employee(
            name="Alex Johnson (Buddy)",
            email="alex.j@meridian.com",
            slack_handle="@alex.j",
            role="employee",
            department="Engineering",
            hire_date=datetime.date(2023, 6, 10),
            hashed_password=default_pwd,
            hybrid_preference="HIBRID",
            assigned_desk="desk-25"
        )
        session.add(buddy)
        await session.flush() # Flush to get buddy ID

        # 3. Jane Doe (New Hire / Preboardee)
        # Note: In PRD / db.ts, Jane Doe starts on 2026-07-01
        new_hire = Employee(
            name="Jane Doe",
            email="jane.doe@meridian.com",
            slack_handle="@jane.doe",
            role="preboardee",
            department="Engineering",
            hire_date=datetime.date(2026, 7, 1),
            buddy_id=buddy.id,
            hashed_password=default_pwd,
            hybrid_preference="BIROU",
            assigned_desk="desk-24"
        )
        session.add(new_hire)
        await session.flush() # Flush to get new_hire ID

        # Seed Jane Doe's checklist tasks matching db.ts
        print("Seeding checklist tasks for Jane Doe...")
        tasks_data = [
            {"title": "Sign employment contract", "description": "Complete electronic signing of your contract and annexes in the portal.", "status": "completed", "dependencies": []},
            {"title": "Configure work laptop", "description": "Install operating system, VPN client, and core development tools.", "status": "in_progress", "dependencies": []}, # Let's keep dependencies simple
            {"title": "First meeting with Buddy", "description": "Schedule a 30-minute Zoom or coffee meet to get to know each other.", "status": "pending", "dependencies": ["Configure work laptop"]},
            {"title": "Install corporate security software", "description": "Install the local security agent before accessing the internal network.", "status": "blocked", "dependencies": ["Configure work laptop", "First meeting with Buddy"]},
            {"title": "Information security training", "description": "Complete the mandatory interactive training on the HR platform.", "status": "pending", "dependencies": ["Sign employment contract"]},
            {"title": "Meet the team members", "description": "Schedule informal 1-on-1 chats with other engineers in your department.", "status": "pending", "dependencies": []},
            {"title": "Submit first Pull Request (PR)", "description": "Fix a small bug or implement a minor change in the main codebase.", "status": "pending", "dependencies": ["Configure work laptop"]},
            {"title": "Present a mini-demo", "description": "Showcase your completed project during the weekly engineering sync.", "status": "pending", "dependencies": ["Submit first Pull Request (PR)"]}
        ]

        task_instances = {}
        for td in tasks_data:
            task = ChecklistTask(
                employee_id=new_hire.id,
                title=td["title"],
                description=td["description"],
                status=td["status"],
                dependencies=[] # populated below
            )
            session.add(task)
            await session.flush()
            task_instances[td["title"]] = task

        # Now link parent/child dependency constraints and foreign keys
        # "blocked_by" is task-2 ("Configure work laptop")
        laptop_task = task_instances["Configure work laptop"]
        meeting_task = task_instances["First meeting with Buddy"]
        security_task = task_instances["Install corporate security software"]
        security_task.blocked_by = laptop_task.id
        
        # Populate dependencies lists with UUID strings of dependee tasks
        for td in tasks_data:
            t_title = td["title"]
            resolved_deps = [str(task_instances[dep_title].id) for dep_title in td["dependencies"]]
            task_instances[t_title].dependencies = resolved_deps

        # Seed initial Schedule Entries matching db.ts (DayIndex mappings converted to dates)
        # Week of July 6, 2026: 
        # Monday July 6 (0): Jane Doe, Alex Johnson
        # Tuesday July 7 (1): Jane Doe, Alex Johnson
        # Wednesday July 8 (2): Alex Johnson
        # Thursday July 9 (3): Jane Doe, Alex Johnson
        # Friday July 10 (4): (none)
        print("Seeding schedule entries...")
        ref_monday = datetime.date(2026, 7, 6)
        
        # Add new_hire schedules
        session.add(ScheduleEntry(employee_id=new_hire.id, date=ref_monday, status="office"))
        session.add(ScheduleEntry(employee_id=new_hire.id, date=ref_monday + datetime.timedelta(days=1), status="office"))
        session.add(ScheduleEntry(employee_id=new_hire.id, date=ref_monday + datetime.timedelta(days=3), status="office"))

        # Add buddy schedules
        session.add(ScheduleEntry(employee_id=buddy.id, date=ref_monday, status="office"))
        session.add(ScheduleEntry(employee_id=buddy.id, date=ref_monday + datetime.timedelta(days=1), status="office"))
        session.add(ScheduleEntry(employee_id=buddy.id, date=ref_monday + datetime.timedelta(days=2), status="office"))
        session.add(ScheduleEntry(employee_id=buddy.id, date=ref_monday + datetime.timedelta(days=3), status="office"))

        # 4. Virtual Employees (from index 4 to 210) for virtualization test
        print("Seeding virtual employees...")
        DEPARTMENTS = ['Engineering', 'Sales', 'Marketing', 'HR', 'Finance']
        virtual_employees = []
        for i in range(4, 211):
            is_buddy = (i % 8 == 0)
            dept = DEPARTMENTS[i % len(DEPARTMENTS)]
            
            # Date calculations
            year = 2025
            month = (i % 12) + 1
            day = (i % 28) + 1
            h_date = datetime.date(year, month, day)

            virtual_emp = Employee(
                name=f"Employee Name {i}",
                email=f"user.{i}@meridian.com",
                slack_handle=f"@user.{i}",
                role="employee" if not is_buddy else "employee", # keep it standard
                department=dept,
                hire_date=h_date,
                hashed_password=default_pwd,
                hybrid_preference="BIROU" if (i % 3 == 0) else ("REMOTE" if i % 3 == 1 else "HIBRID")
            )
            session.add(virtual_emp)
            virtual_employees.append(virtual_emp)

        await session.flush() # Flush to get all virtual employee IDs

        # Populate schedule entries for virtual employees (3 days each)
        for idx, ve in enumerate(virtual_employees):
            # Choose 3 days deterministically
            days_off = [0, 1, 2, 3, 4]
            # pick 3 days based on index
            chosen_days = [days_off[(idx + d) % 5] for d in range(3)]
            for d in chosen_days:
                session.add(ScheduleEntry(
                    employee_id=ve.id,
                    date=ref_monday + datetime.timedelta(days=d),
                    status="office"
                ))

        await session.commit()
        print("Database seeding completed successfully!")

if __name__ == "__main__":
    asyncio.run(seed())
