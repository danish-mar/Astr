(function () {
    const initComponent = () => {
        Alpine.data('loginData', () => ({
            credentials: {
                username: '',
                password: ''
            },
            showPassword: false,
            loading: false,
            error: '',

            async login() {
                this.error = '';
                this.loading = true;

                try {
                    const response = await axios.post('/api/v1/employees/login', this.credentials);

                    if (response.data.success) {
                        // Store token
                        localStorage.setItem('astr_token', response.data.data.token);
                        localStorage.setItem('astr_user', JSON.stringify(response.data.data.employee));

                        // Redirect to dashboard
                        window.location.href = '/dashboard';
                    } else {
                        this.error = response.data.message || 'Login failed';
                    }
                } catch (error) {
                    console.error('Login error:', error);
                    this.error = error.response?.data?.message || 'Invalid username or password';
                } finally {
                    this.loading = false;
                }
            }
        }));
    };

    if (window.Alpine) {
        initComponent();
    } else {
        document.addEventListener('alpine:init', initComponent);
    }
})();
