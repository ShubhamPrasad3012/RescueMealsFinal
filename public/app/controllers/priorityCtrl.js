
angular.module('priorityController', [])

.controller('priorityDashboardCtrl', function($http) {
    var vm = this;

    vm.loading = false;
    vm.error = '';
    vm.data = null;
    vm.matches = [];

    vm.load = function() {
        vm.loading = true;
        vm.error = '';

        $http.get('/api/priority/queue')
            .then(function(response) {
                var data = response.data;

                if (!data || !data.success) {
                    throw new Error(
                        (data && data.message) ||
                        'Could not load priority matches.'
                    );
                }

                vm.data = data;
                vm.matches = data.matches || [];
            })
            .catch(function(error) {
                vm.error =
                    error.data && error.data.message
                        ? error.data.message
                        : error.message ||
                          'Failed to load priority matches.';
            })
            .finally(function() {
                vm.loading = false;
            });
    };

    vm.load();
});
