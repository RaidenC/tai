using Xunit;

// JUNIOR RATIONALE: Our Integration Tests use TDM (Test Data Management) 
// which wipes the database. If we run tests in parallel, one test 
// will wipe the DB while another is reading it.
// To keep things simple and reliable for this POC, we run sequentially.
[assembly: CollectionBehavior(DisableTestParallelization = true)]
