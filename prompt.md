# TASK

Select the most important issue from @issues/

Only work on the issue specified.

# CONTEXT

Here are the last 10 commits:

<recent-commits>

!`git log -n 10 --format="%H%n%ad%n%B---" --date=short`

</recent-commits>

# EXPLORATION

Explore the repo and fill your context window with relevant information that will allow you to complete the task.

Pay extra attention to test files that touch the relevant parts of the code.

# EXECUTION

If applicable, use RGR to complete the task.

1. RED: write one test
2. GREEN: write the implementation to pass that test
3. REPEAT until done
4. REFACTOR the code

# FEEDBACK LOOPS

Before committing, run typecheck then run tests to ensure no regressions.

# COMMIT

Make a git commit. The commit message must:

1. Include issue completed
2. Key decisions made
3. Blockers or notes for next iteration

Keep it concise.

# THE ISSUE

If the task is not complete, leave a comment in the respective issue file.

# FINAL RULES

ONLY WORK ON A SINGLE TASK.
