import axios from "axios";

const Api = axios.create({
  withCredentials: true,
  xsrfCookieName: 'csrf_token',
  xsrfHeaderName: 'X-CSRF-Token'
});

export default Api;
