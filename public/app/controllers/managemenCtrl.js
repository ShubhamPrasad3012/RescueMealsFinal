
angular.module('priorityController')

.controller('recipientManagementCtrl', function($http) {
    var vm = this;

    vm.items = [];
    vm.loading = false;
    vm.error = '';
    vm.success = '';

    vm.form = {
        name: '',
        city: 'Vellore',
        state: 'Tamil Nadu',
        address: '',
        dailyMealDemand: 100,
        receivingCapacity: 50
    };

    vm.load = function() {
        vm.loading = true;
        vm.error = '';

        $http.get('/api/recipients')
            .then(function(response) {
                if (!response.data.success) {
                    throw new Error(response.data.message);
                }

                vm.items = response.data.recipients || [];
            })
            .catch(function(error) {
                vm.error = error.data && error.data.message
                    ? error.data.message
                    : error.message || 'Could not load recipients.';
            })
            .finally(function() {
                vm.loading = false;
            });
    };

    vm.add = function() {
        vm.error = '';
        vm.success = '';

        $http.post('/api/recipients', vm.form)
            .then(function(response) {
                if (!response.data.success) {
                    throw new Error(response.data.message);
                }

                vm.success = response.data.message;
                vm.form.name = '';
                vm.form.address = '';
                vm.load();
            })
            .catch(function(error) {
                vm.error = error.data && error.data.message
                    ? error.data.message
                    : error.message || 'Could not register recipient.';
            });
    };

    vm.update = function(item, changes) {
        vm.error = '';
        vm.success = '';

        $http.patch('/api/recipients/' + item._id, changes)
            .then(function(response) {
                if (!response.data.success) {
                    throw new Error(response.data.message);
                }

                vm.success = response.data.message;
                vm.load();
            })
            .catch(function(error) {
                vm.error = error.data && error.data.message
                    ? error.data.message
                    : error.message || 'Could not update recipient.';
            });
    };

    vm.load();
})

.controller('volunteerManagementCtrl', function($http) {
    var vm = this;

    vm.items = [];
    vm.loading = false;
    vm.error = '';
    vm.success = '';

    vm.form = {
        name: '',
        city: 'Vellore',
        state: 'Tamil Nadu',
        address: '',
        coverageRadiusKm: 10,
        carryingCapacity: 50
    };

    vm.load = function() {
        vm.loading = true;
        vm.error = '';

        $http.get('/api/volunteers')
            .then(function(response) {
                if (!response.data.success) {
                    throw new Error(response.data.message);
                }

                vm.items = response.data.volunteers || [];
            })
            .catch(function(error) {
                vm.error = error.data && error.data.message
                    ? error.data.message
                    : error.message || 'Could not load volunteers.';
            })
            .finally(function() {
                vm.loading = false;
            });
    };

    vm.add = function() {
        vm.error = '';
        vm.success = '';

        $http.post('/api/volunteers', vm.form)
            .then(function(response) {
                if (!response.data.success) {
                    throw new Error(response.data.message);
                }

                vm.success = response.data.message;
                vm.form.name = '';
                vm.form.address = '';
                vm.load();
            })
            .catch(function(error) {
                vm.error = error.data && error.data.message
                    ? error.data.message
                    : error.message || 'Could not register volunteer.';
            });
    };

    vm.update = function(item, changes) {
        vm.error = '';
        vm.success = '';

        $http.patch('/api/volunteers/' + item._id, changes)
            .then(function(response) {
                if (!response.data.success) {
                    throw new Error(response.data.message);
                }

                vm.success = response.data.message;
                vm.load();
            })
            .catch(function(error) {
                vm.error = error.data && error.data.message
                    ? error.data.message
                    : error.message || 'Could not update volunteer.';
            });
    };

    vm.load();
});
